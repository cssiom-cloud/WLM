Add-Type -AssemblyName System.Drawing

$srcPath = "d:\Vscode\PRO\web\assets\1.jpg"
$src = [System.Drawing.Bitmap]::new($srcPath)

function Create-CircularBitmap($source, $size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $margin = [Math]::Max(1, [int]($size * 0.02))
    $innerSize = $size - (2 * $margin)
    $path.AddEllipse($margin, $margin, $innerSize, $innerSize)

    # Background circle
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 24, 29))
    $g.FillEllipse($bgBrush, $margin, $margin, $innerSize, $innerSize)
    $bgBrush.Dispose()

    # Clip to circle
    $g.SetClip($path)
    $g.DrawImage($source, $margin, $margin, $innerSize, $innerSize)
    $g.ResetClip()

    # Circular border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 138, 144, 255), [Math]::Max(1, [float]($size * 0.03)))
    $g.DrawEllipse($pen, $margin, $margin, $innerSize, $innerSize)
    $pen.Dispose()
    $path.Dispose()
    $g.Dispose()

    return $bmp
}

# Save 256x256 and 512x512 PNG
$bmp512 = Create-CircularBitmap $src 512
$bmp512.Save("d:\Vscode\PRO\web\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()

# Create multi-size ICO
$sizes = @(256, 128, 64, 48, 32, 16)
$pngBytesList = @()

foreach ($sz in $sizes) {
    $bmp = Create-CircularBitmap $src $sz
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,@($sz, $ms.ToArray())
    $ms.Dispose()
    $bmp.Dispose()
}
$src.Dispose()

# Build ICO binary
$icoMs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($icoMs)

# Header: reserved(0), type(1=icon), count
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$pngBytesList.Count)

$offset = 6 + (16 * $pngBytesList.Count)

foreach ($item in $pngBytesList) {
    $sz = $item[0]
    $bytes = $item[1]
    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Planes
    $bw.Write([uint16]32) # Bit count
    $bw.Write([uint32]$bytes.Length) # Bytes in resource
    $bw.Write([uint32]$offset) # Offset
    $offset += $bytes.Length
}

foreach ($item in $pngBytesList) {
    $bytes = $item[1]
    $bw.Write($bytes)
}

[System.IO.File]::WriteAllBytes("d:\Vscode\PRO\web\assets\icon.ico", $icoMs.ToArray())
$bw.Dispose()
$icoMs.Dispose()
Write-Output "Generated assets\icon.png and assets\icon.ico successfully!"
