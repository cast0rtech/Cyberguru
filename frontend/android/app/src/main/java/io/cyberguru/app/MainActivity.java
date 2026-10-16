package io.cyberguru.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
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

public class MainActivity extends BridgeActivity {

    private LocationManager locationManager;
    private GnssStatus.Callback gnssStatusCallback;
    private LocationListener locationListener;
    private final JSONObject latestGnssData = new JSONObject();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initGnss();
    }

    private void initGnss() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        // Registrar JavascriptInterface en el WebView para consultas directas desde React
        WebView webView = this.findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) {
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
        }

        setupGnssCallbacks();
    }

    private void setupGnssCallbacks() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 1001);
            return;
        }

        startGnssUpdates();
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

            dispatchToWebView();
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

            dispatchToWebView();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void dispatchToWebView() {
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

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001 && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startGnssUpdates();
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
    }
}
