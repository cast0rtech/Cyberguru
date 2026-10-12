param (
    [string]$SourceImage = "C:\Users\castor\.gemini\antigravity-ide\brain\d2ab9981-9578-4737-8b71-f17a174f02d1\.user_uploaded\media_1791790275277.jpg"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceImage)) {
    Write-Host "[X] Imagen origen no encontrada: $SourceImage" -ForegroundColor Red
    exit 1
}

$srcBitmap = [System.Drawing.Bitmap]::FromFile($SourceImage)
Write-Host "[*] Cargando imagen original: $($srcBitmap.Width)x$($srcBitmap.Height)" -ForegroundColor Cyan

function Resize-Bitmap($bmp, $targetWidth, $targetHeight) {
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
    $destImage = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $destImage.SetResolution($bmp.HorizontalResolution, $bmp.VerticalResolution)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $wrapMode = New-Object System.Drawing.Imaging.ImageAttributes
    $wrapMode.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $graphics.DrawImage($bmp, $destRect, 0, 0, $bmp.Width, $bmp.Height, [System.Drawing.GraphicsUnit]::Pixel, $wrapMode)
    $graphics.Dispose()
    return $destImage
}

# 1. Guardar PNG principal y assets web
$png1024 = Resize-Bitmap $srcBitmap 1024 1024
$png1024.Save("app_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png1024.Save("frontend\public\app_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png1024.Save("frontend\src\assets\app_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "(+) Guardado app_icon.png (1024x1024)" -ForegroundColor Green

# Favicon PNG (64x64 y 32x32)
$fav64 = Resize-Bitmap $srcBitmap 64 64
$fav64.Save("frontend\public\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fav64.Dispose()

# 2. Generar archivo .ICO para Windows
# Estructura ICO con encabezado y entradas para 256, 128, 64, 48, 32, 16
$icoSizes = @(16, 32, 48, 64, 128, 256)
$icoStreams = @()

foreach ($sz in $icoSizes) {
    $resized = Resize-Bitmap $srcBitmap $sz $sz
    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    $icoStreams += @{
        Size = $sz
        Bytes = $ms.ToArray()
    }
    $ms.Dispose()
}

$icoFs = [System.IO.File]::Create("app_icon.ico")
$bw = New-Object System.IO.BinaryWriter($icoFs)

# Header ICO: 0, 1 (ICON type), count
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$icoStreams.Count)

$offset = 6 + (16 * $icoStreams.Count)

foreach ($entry in $icoStreams) {
    $wByte = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
    $hByte = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
    $bw.Write($wByte)
    $bw.Write($hByte)
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Planes
    $bw.Write([uint16]32) # Bit count
    $bw.Write([uint32]$entry.Bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $entry.Bytes.Length
}

foreach ($entry in $icoStreams) {
    $bw.Write($entry.Bytes)
}

$bw.Flush()
$icoFs.Close()
Write-Host "(+) Guardado app_icon.ico para Windows" -ForegroundColor Green

# Copiar app_icon.ico a installer y dist-windows
Copy-Item "app_icon.ico" "installer\app_icon.ico" -Force
Copy-Item "app_icon.ico" "dist-windows\Cyberguru-Portable\app_icon.ico" -Force -ErrorAction SilentlyContinue

# 3. Generar iconos de Android si existen las carpetas
$androidMipmaps = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}

$resDir = "frontend\android\app\src\main\res"
if (Test-Path $resDir) {
    foreach ($density in $androidMipmaps.Keys) {
        $dim = $androidMipmaps[$density]
        $folder = Join-Path $resDir "mipmap-$density"
        if (Test-Path $folder) {
            $rBmp = Resize-Bitmap $srcBitmap $dim $dim
            $rBmp.Save((Join-Path $folder "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            $rBmp.Save((Join-Path $folder "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            $rBmp.Save((Join-Path $folder "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            $rBmp.Dispose()
        }
    }
    Write-Host "(+) Iconos de Android actualizados en res/mipmap-*" -ForegroundColor Green
}

$srcBitmap.Dispose()
$png1024.Dispose()

Write-Host "(+) Todos los iconos de Cyberguru generados con exito!" -ForegroundColor Cyan
