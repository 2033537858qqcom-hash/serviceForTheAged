from PIL import Image, ImageDraw
import math

# Supersampling 4x: draw at 1760x288, downscale to 440x72 (which displays at 220rpx x 36rpx in WeChat)
w, h = 1760, 288
scale = 8.0 # base coordinate system 220 x 36

img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

def pt(x, y):
    return (x * scale, y * scale)

# Main stem cubic bezier: (8,18) -> (45,18) -> (68,14) -> (110,18) -> (152,22) -> (175,18) -> (212,18)
def bezier_point(p0, p1, p2, p3, t):
    x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
    y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
    return (x, y)

# Left vine
p0 = (8, 18)
p1 = (50, 18)
p2 = (75, 14)
p3 = (110, 18)
left_pts = [bezier_point(p0, p1, p2, p3, i / 80.0) for i in range(81)]

# Right vine
p4 = (110, 18)
p5 = (145, 22)
p6 = (170, 18)
p7 = (212, 18)
right_pts = [bezier_point(p4, p5, p6, p7, i / 80.0) for i in range(81)]

full_stem = left_pts + right_pts[1:]

# Draw main stem with fading opacity at ends
for i in range(len(full_stem) - 1):
    x1, y1 = full_stem[i]
    x2, y2 = full_stem[i+1]
    mid_x = (x1 + x2) / 2.0
    # opacity factor: highest at 110 (center), drops towards 8 and 212
    dist_from_center = abs(mid_x - 110)
    norm = min(1.0, dist_from_center / 102.0)
    alpha = int((1.0 - norm * 0.88) * 190)
    color = (23, 107, 93, max(15, alpha))
    draw.line([pt(x1, y1), pt(x2, y2)], fill=color, width=int(1.8 * scale))

def draw_leaf(origin, angle_deg, length, width, fill_color, stroke_color):
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    ox, oy = origin
    # Leaf outline: tip is at length along angle
    # side points at length * 0.45 +/- width
    pts = []
    steps = 30
    # top curve
    for i in range(steps + 1):
        t = i / steps
        lx = t * length
        ly = -math.sin(t * math.pi) * width
        rx = ox + lx * cos_a - ly * sin_a
        ry = oy + lx * sin_a + ly * cos_a
        pts.append(pt(rx, ry))
    # bottom curve back
    for i in range(steps, -1, -1):
        t = i / steps
        lx = t * length
        ly = math.sin(t * math.pi) * (width * 0.85)
        rx = ox + lx * cos_a - ly * sin_a
        ry = oy + lx * sin_a + ly * cos_a
        pts.append(pt(rx, ry))
    draw.polygon(pts, fill=fill_color)
    draw.line(pts + [pts[0]], fill=stroke_color, width=int(1.1 * scale))

# Left leaves
# Leaf 1: at x=82, curving up-left (150 deg)
draw_leaf((82, 16.5), 148, 17, 6.2, (23, 107, 93, 85), (23, 107, 93, 160))
# Leaf 2: at x=50, curving down-left (205 deg)
draw_leaf((50, 18), 205, 14, 5.2, (23, 107, 93, 65), (23, 107, 93, 135))
# Small left bud
draw.ellipse([pt(24-1.8, 18-1.8), pt(24+1.8, 18+1.8)], fill=(23, 107, 93, 90))

# Right leaves
# Leaf 3: at x=138, curving up-right (32 deg)
draw_leaf((138, 19.5), 32, 17, 6.2, (23, 107, 93, 85), (23, 107, 93, 160))
# Leaf 4: at x=170, curving down-right (-25 deg)
draw_leaf((170, 18), -25, 14, 5.2, (23, 107, 93, 65), (23, 107, 93, 135))
# Small right bud
draw.ellipse([pt(196-1.8, 18-1.8), pt(196+1.8, 18+1.8)], fill=(23, 107, 93, 90))

# Center bloom / sprouts:
# Top sprout leaf (curving up)
draw_leaf((110, 15), 90, 12, 4.8, (23, 107, 93, 120), (23, 107, 93, 190))
# Bottom sprout leaf (curving down)
draw_leaf((110, 21), 270, 12, 4.8, (23, 107, 93, 120), (23, 107, 93, 190))

# Center golden floral dewdrop / blossom pistil
draw.ellipse([pt(110-5, 18-5), pt(110+5, 18+5)], outline=(217, 119, 54, 90), width=int(0.9 * scale))
draw.ellipse([pt(110-3.2, 18-3.2), pt(110+3.2, 18+3.2)], fill=(217, 119, 54, 215))

# High-quality anti-aliased downsampling (440 x 72)
final_img = img.resize((440, 72), Image.Resampling.LANCZOS)
final_img.save("miniprogram/assets/icons/floral-deco.png", "PNG")
print("floral-deco.png generated successfully: 440x72")
