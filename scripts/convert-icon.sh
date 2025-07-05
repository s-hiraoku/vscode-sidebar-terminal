
# Convert SVG to PNG using Inkscape (if available)
# or use online converter: https://convertio.co/svg-png/

# For 128x128 PNG (extension icon)
inkscape --export-type=png --export-width=128 --export-height=128 --export-filename=resources/icon.png resources/icon.svg

# For 120x120 PNG (marketplace)
inkscape --export-type=png --export-width=120 --export-height=120 --export-filename=resources/icon-120.png resources/icon.svg

echo "Icon conversion complete"
