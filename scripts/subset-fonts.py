"""Optional font-asset maintenance; FontTools is not needed for a normal build."""
from pathlib import Path
from fontTools import subset

for name in ('Geist-Variable.woff2', 'GeistMono-Variable.woff2'):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    font = subset.load_font(str(Path('app/public/fonts') / name), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=list(range(256)) + list(range(0x2000, 0x2070)) + list(range(0x2190, 0x2200)) + [0x25C6, 0x2713])
    subsetter.subset(font)
    subset.save_font(font, str(Path('landing/fonts') / name), options)
