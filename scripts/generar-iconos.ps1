# scripts/generar-iconos.ps1 — genera los PNG de la PWA a partir del diseño de public/favicon.svg.
#
# Por qué existe: iOS no acepta SVG como icono y Chrome/Android piden 192 y 512 en PNG. En vez de
# guardar binarios que nadie sabe de dónde salieron, se dibujan acá (System.Drawing, sin
# dependencias) siguiendo el mismo diseño del favicon: fondo verde #16a34a + 3 velas japonesas.
#
# Uso:  powershell -NoProfile -File scripts/generar-iconos.ps1
# Salida: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
#
# Los que van a "sangre" (maskable y apple): fondo cuadrado completo, sin esquinas redondeadas y con
# el dibujo al 78%, porque Android recorta el maskable en círculo y iOS aplica su propia máscara.

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$verde    = [System.Drawing.Color]::FromArgb(22, 163, 74)      # #16a34a, el del favicon
$blanco   = [System.Drawing.Color]::White
$blanco60 = [System.Drawing.Color]::FromArgb(153, 255, 255, 255)  # velas bajistas, 60%

$outDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Rectángulo con esquinas redondeadas, como los <rect rx="1"> del favicon.
function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# $contenido: proporción del lienzo que ocupa el dibujo del favicon (1.0 = a sangre; 0.78 = maskable).
function New-Icono([int]$size, [string]$file, [double]$contenido, [bool]$redondeado) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  if ($redondeado) {
    $g.Clear([System.Drawing.Color]::Transparent)
    $radio = [float]($size * 6 / 32)   # 6/32 es el rx del favicon
    $fondo = New-RoundedPath 0 0 $size $size $radio
    $g.FillPath((New-Object System.Drawing.SolidBrush($verde)), $fondo)
    $fondo.Dispose()
  } else {
    $g.Clear($verde)                   # opaco y a sangre: iOS no acepta transparencia en el suyo
  }

  # Escala del viewBox de 32 unidades y centrado del dibujo.
  $s = [double]($size * $contenido / 32)
  $o = [double](($size - 32 * $s) / 2)

  $pen = New-Object System.Drawing.Pen($blanco, [float](1.5 * $s))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $brillo = New-Object System.Drawing.SolidBrush($blanco)
  $opaco = New-Object System.Drawing.SolidBrush($blanco60)

  # Vela 1 (izquierda, bajista): mecha, cuerpo al 60% y mecha.
  $g.DrawLine($pen, [float]($o + 8 * $s), [float]($o + 7 * $s), [float]($o + 8 * $s), [float]($o + 10 * $s))
  $c1 = New-RoundedPath ([float]($o + 5.5 * $s)) ([float]($o + 10 * $s)) ([float](5 * $s)) ([float](7 * $s)) ([float]$s)
  $g.FillPath($opaco, $c1)
  $c1.Dispose()
  $g.DrawLine($pen, [float]($o + 8 * $s), [float]($o + 17 * $s), [float]($o + 8 * $s), [float]($o + 21 * $s))

  # Vela 2 (centro, alcista).
  $g.DrawLine($pen, [float]($o + 16 * $s), [float]($o + 8 * $s), [float]($o + 16 * $s), [float]($o + 12 * $s))
  $c2 = New-RoundedPath ([float]($o + 13.5 * $s)) ([float]($o + 12 * $s)) ([float](5 * $s)) ([float](9 * $s)) ([float]$s)
  $g.FillPath($brillo, $c2)
  $c2.Dispose()
  $g.DrawLine($pen, [float]($o + 16 * $s), [float]($o + 21 * $s), [float]($o + 16 * $s), [float]($o + 25 * $s))

  # Vela 3 (derecha, alcista grande).
  $g.DrawLine($pen, [float]($o + 24 * $s), [float]($o + 5 * $s), [float]($o + 24 * $s), [float]($o + 9 * $s))
  $c3 = New-RoundedPath ([float]($o + 21.5 * $s)) ([float]($o + 9 * $s)) ([float](5 * $s)) ([float](12 * $s)) ([float]$s)
  $g.FillPath($brillo, $c3)
  $c3.Dispose()
  $g.DrawLine($pen, [float]($o + 24 * $s), [float]($o + 21 * $s), [float]($o + 24 * $s), [float]($o + 26 * $s))

  $destino = Join-Path $outDir $file
  $bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)

  $pen.Dispose(); $brillo.Dispose(); $opaco.Dispose(); $g.Dispose(); $bmp.Dispose()
  Write-Host ("  {0,-24} {1,5}px  {2,7} bytes" -f $file, $size, (Get-Item $destino).Length)
}

Write-Host 'Generando iconos de la PWA en public/icons:'
New-Icono 192 'icon-192.png'          1.0  $true
New-Icono 512 'icon-512.png'          1.0  $true
New-Icono 512 'icon-maskable-512.png' 0.78 $false
New-Icono 180 'apple-touch-icon.png'  0.78 $false
Write-Host 'Listo.'
