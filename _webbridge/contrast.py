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

combos = [
    ('foreground #111827 on cream #FAF6F0 (body text)', '#111827', '#FAF6F0'),
    ('primary teal #1E4D4F on cream (current body class)', '#1E4D4F', '#FAF6F0'),
    ('gold #D97706 on cream (Our Story subheading)', '#D97706', '#FAF6F0'),
    ('white on gold #D97706 (announcement + CTAs)', '#FFFFFF', '#D97706'),
    ('white on teal #1E4D4F (primary buttons)', '#FFFFFF', '#1E4D4F'),
    ('white on plum #935B8A (plum buttons)', '#FFFFFF', '#935B8A'),
    ('white on purple #8400FF (btn-primary-tactile)', '#FFFFFF', '#8400FF'),
    ('gold-light #E68A00 on cream (gold hover text)', '#E68A00', '#FAF6F0'),
    ('gold #D97706 on white (links on white cards)', '#D97706', '#FFFFFF'),
    ('foreground/80 on cream (secondary text)', blend('#111827', 0.8, '#FAF6F0'), '#FAF6F0'),
    ('foreground/70 on cream (helper text)', blend('#111827', 0.7, '#FAF6F0'), '#FAF6F0'),
    ('red-400 #f87171 on white (remove links)', '#f87171', '#FFFFFF'),
    ('teal #0d9488 on white (tracking links)', '#0d9488', '#FFFFFF'),
    ('dark: foreground #F1F5F9 on #0F172A', '#F1F5F9', '#0F172A'),
    ('dark: gold #D97706 on #0F172A (nav active)', '#D97706', '#0F172A'),
    ('dark: gold text on #1E293B (cards)', '#D97706', '#1E293B'),
    ('dark: white on purple #8400FF (btn)', '#FFFFFF', '#8400FF'),
]

for label, fg, bg in combos:
    r = ratio(fg, bg)
    aa = 'PASS' if r >= 4.5 else ('LARGE-ONLY' if r >= 3.0 else 'FAIL')
    aaa = 'PASS' if r >= 7.0 else 'FAIL'
    print(f'{r:6.2f}:1  AA-normal:{aa:12s} AAA-normal:{aaa:5s}  {label}')
