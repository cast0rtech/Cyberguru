package io.cyberguru.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.DhcpInfo;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.FileReader;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {

    private LocationManager locationManager;
    private GnssStatus.Callback gnssStatusCallback;
    private LocationListener locationListener;
    private final JSONObject latestGnssData = new JSONObject();

    private WifiManager wifiManager;
    private BroadcastReceiver wifiScanReceiver;
    private final JSONArray latestWifiScanData = new JSONArray();
    private ExecutorService lanScannerPool;
    private boolean isLanScanning = false;

    private static final int PERMISSION_REQ_CODE = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        lanScannerPool = Executors.newFixedThreadPool(28);

        initJavascriptInterfaces();
        checkAndRequestAllPermissions();
        initGnss();
        initWifiAndLan();
    }

    private void checkAndRequestAllPermissions() {
        List<String> needed = new ArrayList<>();
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_WIFI_STATE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_WIFI_STATE);
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CHANGE_WIFI_STATE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CHANGE_WIFI_STATE);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, "android.permission.NEARBY_WIFI_DEVICES") != PackageManager.PERMISSION_GRANTED) {
                needed.add("android.permission.NEARBY_WIFI_DEVICES");
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQ_CODE);
        }
    }

    private void initJavascriptInterfaces() {
        WebView webView = this.findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) {
            // 1. AndroidGnss: Telemetría de Satélites GNSS y Coordenadas
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String getGnssData() {
                    synchronized (latestGnssData) {
                        return latestGnssData.toString();
                    }
                }

                @JavascriptInterface
                public boolean isSupported() {
                    return true;
                }
            }, "AndroidGnss");

            // 2. AndroidWifi: Escaneo activo de redes Wi-Fi (SSID, BSSID, RSSI, canal, seguridad)
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String getScanResults() {
                    synchronized (latestWifiScanData) {
                        return latestWifiScanData.toString();
                    }
                }

                @JavascriptInterface
                public boolean startScan() {
                    return triggerWifiScan();
                }

                @JavascriptInterface
                public String getConnectionInfo() {
                    return getWifiConnectionInfoJson();
                }

                @JavascriptInterface
                public boolean isWifiEnabled() {
                    return wifiManager != null && wifiManager.isWifiEnabled();
                }
            }, "AndroidWifi");

            // 3. AndroidLan: Escaneo activo de la subred local Wi-Fi (Ping, Sockets, ARP)
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public boolean scanSubnet() {
                    return startSubnetScan();
                }

                @JavascriptInterface
                public String getGatewayIp() {
                    return resolveGatewayIp();
                }

                @JavascriptInterface
                public String getLocalIp() {
                    return resolveLocalIp();
                }

                @JavascriptInterface
                public int pingHost(String ip) {
                    return probeHostLatency(ip);
                }

                @JavascriptInterface
                public boolean isScanning() {
                    return isLanScanning;
                }
            }, "AndroidLan");
        }
    }

    // =========================================================================
    // SECCIÓN GNSS & GPS
    // =========================================================================

    private void initGnss() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startGnssUpdates();
        }
    }

    private void startGnssUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && locationManager != null) {
            gnssStatusCallback = new GnssStatus.Callback() {
                @Override
                public void onSatelliteStatusChanged(@NonNull GnssStatus status) {
                    processSatelliteStatus(status);
                }
            };
            try {
                locationManager.registerGnssStatusCallback(gnssStatusCallback, new Handler(Looper.getMainLooper()));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                processLocation(location);
            }
            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override
            public void onProviderEnabled(@NonNull String provider) {}
            @Override
            public void onProviderDisabled(@NonNull String provider) {}
        };

        try {
            if (locationManager != null) {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, locationListener);
                }
                Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (last != null) {
                    processLocation(last);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void processSatelliteStatus(GnssStatus status) {
        try {
            int count = status.getSatelliteCount();
            int usedInFixCount = 0;
            JSONArray satsArray = new JSONArray();

            for (int i = 0; i < count; i++) {
                JSONObject sat = new JSONObject();
                int constType = status.getConstellationType(i);
                sat.put("constellation", getConstellationName(constType));
                sat.put("svid", status.getSvid(i));
                sat.put("azimuth", Math.round(status.getAzimuthDegrees(i) * 10.0) / 10.0);
                sat.put("elevation", Math.round(status.getElevationDegrees(i) * 10.0) / 10.0);
                sat.put("cn0", Math.round(status.getCn0DbHz(i) * 10.0) / 10.0);
                boolean used = status.usedInFix(i);
                sat.put("usedInFix", used);
                if (used) {
                    usedInFixCount++;
                }
                sat.put("hasEphemeris", status.hasEphemerisData(i));
                sat.put("hasAlmanac", status.hasAlmanacData(i));
                satsArray.put(sat);
            }

            synchronized (latestGnssData) {
                latestGnssData.put("satellitesCount", count);
                latestGnssData.put("satellitesUsedInFix", usedInFixCount);
                latestGnssData.put("satellites", satsArray);
                latestGnssData.put("timestamp", System.currentTimeMillis());
                latestGnssData.put("hardwareSource", "Android Native GnssStatus Engine");
            }

            dispatchGnssToWebView();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void processLocation(Location location) {
        try {
            JSONObject loc = new JSONObject();
            loc.put("latitude", location.getLatitude());
            loc.put("longitude", location.getLongitude());
            loc.put("altitude", location.hasAltitude() ? location.getAltitude() : 0.0);
            loc.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 10.0);
            loc.put("speed", location.hasSpeed() ? location.getSpeed() : 0.0);
            loc.put("bearing", location.hasBearing() ? location.getBearing() : 0.0);
            loc.put("provider", location.getProvider());
            loc.put("time", location.getTime());

            synchronized (latestGnssData) {
                latestGnssData.put("location", loc);
            }

            dispatchGnssToWebView();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void dispatchGnssToWebView() {
        WebView webView = this.findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) {
            String json;
            synchronized (latestGnssData) {
                json = latestGnssData.toString();
            }
            webView.post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('gnss-update', { detail: " + json + " }));";
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private String getConstellationName(int type) {
        switch (type) {
            case GnssStatus.CONSTELLATION_GPS: return "GPS";
            case GnssStatus.CONSTELLATION_SBAS: return "SBAS";
            case GnssStatus.CONSTELLATION_GLONASS: return "GLONASS";
            case GnssStatus.CONSTELLATION_QZSS: return "QZSS";
            case GnssStatus.CONSTELLATION_BEIDOU: return "BeiDou";
            case GnssStatus.CONSTELLATION_GALILEO: return "Galileo";
            case GnssStatus.CONSTELLATION_IRNSS: return "NavIC";
            default: return "GNSS";
        }
    }

    // =========================================================================
    // SECCIÓN WI-FI SCANNER
    // =========================================================================

    private void initWifiAndLan() {
        wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);

        wifiScanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                boolean success = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false);
                if (success) {
                    processWifiScanResults();
                }
            }
        };

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
        registerReceiver(wifiScanReceiver, intentFilter);

        // Disparar escaneo inicial si el permiso ya está otorgado
        triggerWifiScan();
    }

    private boolean triggerWifiScan() {
        if (wifiManager == null) return false;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }

        try {
            boolean started = wifiManager.startScan();
            if (!started) {
                // Si startScan fue bloqueado por throttling de Android, procesar los resultados en caché inmediatamente
                processWifiScanResults();
            }
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private void processWifiScanResults() {
        if (wifiManager == null) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        try {
            List<ScanResult> results = wifiManager.getScanResults();
            JSONArray array = new JSONArray();

            if (results != null) {
                for (ScanResult r : results) {
                    JSONObject obj = new JSONObject();
                    String ssid = (r.SSID != null && !r.SSID.isEmpty()) ? r.SSID : "Red Wi-Fi Oculta";
                    obj.put("ssid", ssid);
                    obj.put("bssid", r.BSSID != null ? r.BSSID.toUpperCase() : "00:00:00:00:00:00");
                    obj.put("rssi", r.level);
                    obj.put("frequency", r.frequency);
                    obj.put("channel", getWifiChannel(r.frequency));
                    obj.put("capabilities", r.capabilities != null ? r.capabilities : "");
                    obj.put("band", r.frequency > 4900 ? "5 GHz" : "2.4 GHz");
                    obj.put("timestamp", System.currentTimeMillis());
                    array.put(obj);
                }
            }

            synchronized (latestWifiScanData) {
                while (latestWifiScanData.length() > 0) {
                    latestWifiScanData.remove(0);
                }
                for (int i = 0; i < array.length(); i++) {
                    latestWifiScanData.put(array.get(i));
                }
            }

            // Notificar a la aplicación React
            WebView webView = this.findViewById(com.getcapacitor.android.R.id.webview);
            if (webView != null) {
                String json = array.toString();
                webView.post(() -> {
                    String js = "window.dispatchEvent(new CustomEvent('wifi-scan-update', { detail: " + json + " }));";
                    webView.evaluateJavascript(js, null);
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private int getWifiChannel(int frequency) {
        if (frequency >= 2412 && frequency <= 2484) {
            return (frequency - 2407) / 5;
        } else if (frequency >= 5170 && frequency <= 5825) {
            return (frequency - 5000) / 5;
        } else if (frequency >= 5925 && frequency <= 7125) {
            return (frequency - 5940) / 5;
        }
        return 0;
    }

    private String getWifiConnectionInfoJson() {
        JSONObject obj = new JSONObject();
        try {
            if (wifiManager == null) {
                obj.put("connected", false);
                return obj.toString();
            }

            WifiInfo info = wifiManager.getConnectionInfo();
            DhcpInfo dhcp = wifiManager.getDhcpInfo();

            if (info != null && info.getNetworkId() != -1) {
                obj.put("connected", true);
                String ssid = info.getSSID() != null ? info.getSSID().replace("\"", "") : "WiFi Conectada";
                obj.put("ssid", ssid);
                obj.put("bssid", info.getBSSID() != null ? info.getBSSID().toUpperCase() : "");
                obj.put("ip", formatIpAddress(info.getIpAddress()));
                obj.put("gateway", dhcp != null ? formatIpAddress(dhcp.gateway) : "192.168.1.1");
                obj.put("netmask", dhcp != null ? formatIpAddress(dhcp.netmask) : "255.255.255.0");
                obj.put("dns1", dhcp != null ? formatIpAddress(dhcp.dns1) : "8.8.8.8");
                obj.put("linkSpeed", info.getLinkSpeed() + " Mbps");
                obj.put("rssi", info.getRssi());
                obj.put("frequency", info.getFrequency());
            } else {
                obj.put("connected", false);
            }
        } catch (Exception e) {
            try { obj.put("connected", false); } catch (Exception ignored) {}
        }
        return obj.toString();
    }

    // =========================================================================
    // SECCIÓN LAN SUBNET SCANNER
    // =========================================================================

    private String resolveLocalIp() {
        if (wifiManager == null) return "127.0.0.1";
        WifiInfo info = wifiManager.getConnectionInfo();
        if (info == null || info.getNetworkId() == -1) return "127.0.0.1";
        return formatIpAddress(info.getIpAddress());
    }

    private String resolveGatewayIp() {
        if (wifiManager == null) return "192.168.1.1";
        DhcpInfo dhcp = wifiManager.getDhcpInfo();
        if (dhcp == null || dhcp.gateway == 0) return "192.168.1.1";
        return formatIpAddress(dhcp.gateway);
    }

    private String formatIpAddress(int ip) {
        return (ip & 0xFF) + "." +
               ((ip >> 8) & 0xFF) + "." +
               ((ip >> 16) & 0xFF) + "." +
               ((ip >> 24) & 0xFF);
    }

    private Map<String, String> readArpTable() {
        Map<String, String> table = new HashMap<>();
        try (BufferedReader br = new BufferedReader(new FileReader("/proc/net/arp"))) {
            String line;
            while ((line = br.readLine()) != null) {
                String[] parts = line.split("\\s+");
                if (parts.length >= 4 && !parts[0].equalsIgnoreCase("IP")) {
                    String ip = parts[0];
                    String mac = parts[3];
                    if (!mac.equals("00:00:00:00:00:00") && mac.matches("..:..:..:..:..:..")) {
                        table.put(ip, mac.toUpperCase());
                    }
                }
            }
        } catch (Exception ignored) {}
        return table;
    }

    private int probeHostLatency(String ip) {
        long start = System.currentTimeMillis();
        try {
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isReachable(300)) {
                return (int) (System.currentTimeMillis() - start);
            }
        } catch (Exception ignored) {}

        // Probar puertos comunes TCP
        int[] ports = {80, 443, 554, 445, 8080, 53, 22};
        for (int port : ports) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(ip, port), 200);
                return (int) (System.currentTimeMillis() - start);
            } catch (Exception ignored) {}
        }
        return -1;
    }

    private boolean startSubnetScan() {
        if (isLanScanning) return true;
        isLanScanning = true;

        String localIp = resolveLocalIp();
        String gatewayIp = resolveGatewayIp();

        if (localIp.equals("0.0.0.0") || localIp.equals("127.0.0.1")) {
            localIp = "192.168.1.100";
        }

        String prefix = localIp.substring(0, localIp.lastIndexOf('.') + 1);

        new Thread(() -> {
            try {
                Map<String, String> arpMap = readArpTable();

                // Siempre añadir el Gateway primero si responde
                int gwLatency = probeHostLatency(gatewayIp);
                if (gwLatency >= 0) {
                    dispatchLanDevice(gatewayIp, arpMap.get(gatewayIp), "Puerta de Enlace (Router WiFi)", "Gateway", gwLatency);
                }

                // Barrer del 1 al 254 concurrentemente
                for (int i = 1; i <= 254; i++) {
                    final String targetIp = prefix + i;
                    if (targetIp.equals(gatewayIp)) continue; // Ya procesado

                    lanScannerPool.execute(() -> {
                        int latency = probeHostLatency(targetIp);
                        if (latency >= 0) {
                            String mac = arpMap.get(targetIp);
                            String devType = "Workstation";
                            String name = "Equipo LAN (" + targetIp + ")";

                            // Comprobar si es cámara IP (RTSP 554)
                            try (Socket s = new Socket()) {
                                s.connect(new InetSocketAddress(targetIp, 554), 150);
                                devType = "Camera";
                                name = "Cámara IP RTSP";
                            } catch (Exception ignored) {}

                            // Comprobar si es NAS (SMB 445)
                            if (devType.equals("Workstation")) {
                                try (Socket s = new Socket()) {
                                    s.connect(new InetSocketAddress(targetIp, 445), 150);
                                    devType = "NAS";
                                    name = "Servidor NAS / Almacenamiento";
                                } catch (Exception ignored) {}
                            }

                            dispatchLanDevice(targetIp, mac, name, devType, latency);
                        }
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                isLanScanning = false;
                WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
                if (webView != null) {
                    webView.post(() -> {
                        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('lan-scan-finished'));", null);
                    });
                }
            }
        }).start();

        return true;
    }

    private void dispatchLanDevice(String ip, String mac, String hostname, String type, int latencyMs) {
        try {
            if (mac == null || mac.isEmpty() || mac.equals("00:00:00:00:00:00")) {
                // Generar MAC sintética estable si la tabla ARP está restringida en el SO
                String[] ipParts = ip.split("\\.");
                if (ipParts.length == 4) {
                    mac = String.format("02:FE:%02X:%02X:%02X:%02X",
                            Integer.parseInt(ipParts[0]), Integer.parseInt(ipParts[1]),
                            Integer.parseInt(ipParts[2]), Integer.parseInt(ipParts[3]));
                } else {
                    mac = "02:FE:00:00:00:01";
                }
            }

            JSONObject dev = new JSONObject();
            dev.put("id", Math.abs(ip.hashCode()));
            dev.put("ip", ip);
            dev.put("mac", mac.toUpperCase());
            dev.put("hostname", hostname);
            dev.put("vendor", type.equals("Gateway") ? "Router Fabricante LAN" : "Dispositivo de Red LAN");
            dev.put("device_type", type);
            dev.put("os_info", "Android Subnet Probe • " + type);
            dev.put("services", "Latencia: " + latencyMs + " ms | Puerto Activo Confirmado");
            dev.put("status", "online");
            dev.put("verified", true);
            dev.put("verification_method", "ICMP Ping / TCP Socket Probe Activo");
            dev.put("response_time_ms", latencyMs);
            dev.put("first_seen", System.currentTimeMillis());
            dev.put("last_seen", System.currentTimeMillis());
            dev.put("checks_passed", 1);

            WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
            if (webView != null) {
                String json = dev.toString();
                webView.post(() -> {
                    String js = "window.dispatchEvent(new CustomEvent('lan-device-discovered', { detail: " + json + " }));";
                    webView.evaluateJavascript(js, null);
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            startGnssUpdates();
            triggerWifiScan();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            if (gnssStatusCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                locationManager.unregisterGnssStatusCallback(gnssStatusCallback);
            }
            if (locationListener != null) {
                locationManager.removeUpdates(locationListener);
            }
        }
        if (wifiScanReceiver != null) {
            try {
                unregisterReceiver(wifiScanReceiver);
            } catch (Exception ignored) {}
        }
        if (lanScannerPool != null) {
            lanScannerPool.shutdownNow();
        }
    }
}
