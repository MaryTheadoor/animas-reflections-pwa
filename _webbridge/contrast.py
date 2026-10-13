"""Contrast audit for the live Animas Reflections palette.

Run:  python _webbridge/contrast.py

Keep this list in step with src/app/globals.css. It was last refreshed 2026-10-07, when the
semantic tokens landed (gold-deep / gold-ink / on-gold / danger) and red-400 / text-white on
gold were retired.
"""

def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hexcolor):
    hexcolor = hexcolor.lstrip('#')
    r, g, b = (int(hexcolor[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)

def ratio(fg, bg):
    l1, l2 = sorted([luminance(fg), luminance(bg)], reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)

def blend(fg_hex, alpha, bg_hex):
    fg = tuple(int(fg_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
    bg = tuple(int(bg_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
    r = tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))
    return '#{:02x}{:02x}{:02x}'.format(*r)

CREAM = '#FAF6F0'
WHITE = '#FFFFFF'
GOLD = '#D97706'
GOLD_DEEP = '#B45309'      # light-mode token; remaps to #E68A00 under html.dark
GOLD_INK = '#92400E'
GOLD_DEEP_DARK = '#E68A00'
GOLD_INK_DARK = '#F5B84D'  # lighter in dark: it also has to clear a gold/20 tint
ON_GOLD = '#111827'        # deliberately never remapped: the gold face is constant
DANGER = '#dc2626'
DANGER_DARK = '#f87171'
PLUM = '#935B8A'
PLUM_INK = '#7E4B76'
PLUM_INK_DARK = '#C08BB6'
PLUM_LIGHT = '#8E5484'     # hover face; #A86B9F could carry no readable label
ON_PLUM = '#FFFFFF'        # fixed, because --color-white remaps to slate-800 in dark
DARK_BG = '#0F172A'
DARK_CARD = '#1E293B'

combos = [
    # ── light mode ──
    ('body text: foreground #111827 on cream', '#111827', CREAM),
    ('secondary: foreground/80 on cream', blend('#111827', 0.8, CREAM), CREAM),
    ('helper: foreground/70 on cream', blend('#111827', 0.7, CREAM), CREAM),
    ('primary teal #1E4D4F on cream', '#1E4D4F', CREAM),
    ('white on teal #1E4D4F (primary buttons)', WHITE, '#1E4D4F'),
    ('white on plum #935B8A (plum buttons)', WHITE, '#935B8A'),
    ('white on purple #8400FF (btn-primary-tactile)', WHITE, '#8400FF'),
    ('gold-deep on cream (price, nav active, subheadings)', GOLD_DEEP, CREAM),
    ('gold-deep on white (text on cards)', GOLD_DEEP, WHITE),
    ('gold-ink on gold/10 over cream (tinted pills)', GOLD_INK, blend(GOLD, 0.10, CREAM)),
    ('on-gold #111827 on gold (CTA labels)', ON_GOLD, GOLD),
    ('on-gold on gold-light #E68A00 (CTA hover)', ON_GOLD, '#E68A00'),
    ('white on gold-deep (small gold badges)', WHITE, GOLD_DEEP),
    ('danger #dc2626 on white (remove / error)', DANGER, WHITE),
    ('white on red-600 (out-of-stock badge)', WHITE, '#dc2626'),
    ('white on teal-700 (in-stock badge)', WHITE, '#00776e'),
    ('teal-700 on teal-100 (status pill)', '#00776e', '#cbfbf1'),
    ('plum-ink on plum/20 over cream (plum pills)', PLUM_INK, blend(PLUM, 0.20, CREAM)),
    ('on-plum white on plum (plum CTA)', ON_PLUM, PLUM),
    ('on-plum white on plum-light (CTA hover)', ON_PLUM, PLUM_LIGHT),

    # ── dark mode (tokens remapped under html.dark) ──
    ('dark: foreground #F1F5F9 on #0F172A', '#F1F5F9', DARK_BG),
    ('dark: foreground #F1F5F9 on card #1E293B', '#F1F5F9', DARK_CARD),
    ('dark: gold-deep -> #E68A00 on dark bg', GOLD_DEEP_DARK, DARK_BG),
    ('dark: gold-ink -> #F5B84D on dark card', GOLD_INK_DARK, DARK_CARD),
    ('dark: gold-ink -> #F5B84D on gold/20 over dark bg', GOLD_INK_DARK, blend(GOLD, 0.20, DARK_BG)),
    ('dark: plum-ink -> #C08BB6 on plum/20 over dark bg', PLUM_INK_DARK, blend(PLUM, 0.20, DARK_BG)),
    ('dark: on-plum white on plum (plum CTA)', ON_PLUM, PLUM),
    ('dark: on-plum white on plum-light (CTA hover)', ON_PLUM, PLUM_LIGHT),
    ('dark: danger -> #f87171 on dark bg', DANGER_DARK, DARK_BG),
    ('dark: on-gold on gold (face stays gold, label stays dark)', ON_GOLD, GOLD),
    ('dark: slate-800 #1E293B on gold (announcement banner)', '#1E293B', GOLD),
]

failures = 0
for label, fg, bg in combos:
    r = ratio(fg, bg)
    aa = 'PASS' if r >= 4.5 else ('LARGE-ONLY' if r >= 3.0 else 'FAIL')
    aaa = 'PASS' if r >= 7.0 else 'FAIL'
    if aa == 'FAIL':
        failures += 1
    print(f'{r:6.2f}:1  AA-normal:{aa:12s} AAA-normal:{aaa:5s}  {label}')

print()
print(f'{failures} failing combination(s)' if failures else 'all combinations pass AA for normal text')
