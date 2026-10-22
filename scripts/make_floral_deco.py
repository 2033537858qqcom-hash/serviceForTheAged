from PIL import Image, ImageDraw
import math

# Supersampling 8x: base coordinates 260 x 40 -> 2080 x 320
w, h = 2080, 320
scale = 8.0

img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

def pt(x, y):
    return (x * scale, y * scale)

def bezier_point(p0, p1, p2, p3, t):
    x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
    y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
    return (x, y)

# 1. 主藤蔓曲线 (Primary wavy vine)
# Left half: (12, 20) -> (60, 24) -> (90, 16) -> (130, 20)
p0, p1, p2, p3 = (12, 20), (60, 24), (90, 15), (130, 20)
left_stem = [bezier_point(p0, p1, p2, p3, i / 100.0) for i in range(101)]

# Right half: (130, 20) -> (170, 25) -> (200, 16) -> (248, 20)
p4, p5, p6, p7 = (130, 20), (170, 25), (200, 15), (248, 20)
right_stem = [bezier_point(p4, p5, p6, p7, i / 100.0) for i in range(101)]

full_stem1 = left_stem + right_stem[1:]

for i in range(len(full_stem1) - 1):
    x1, y1 = full_stem1[i]
    x2, y2 = full_stem1[i+1]
    mid_x = (x1 + x2) / 2.0
    dist = abs(mid_x - 130)
    norm = min(1.0, dist / 118.0)
    alpha = int((1.0 - norm * 0.85) * 215)
    color = (23, 107, 93, max(18, alpha))
    draw.line([pt(x1, y1), pt(x2, y2)], fill=color, width=int(1.9 * scale))

# 2. 伴生交错柔美细蔓 (Secondary companion vine)
p8, p9, p10, p11 = (35, 20), (70, 13), (105, 25), (130, 20)
sub_left = [bezier_point(p8, p9, p10, p11, i / 60.0) for i in range(61)]
p12, p13, p14, p15 = (130, 20), (155, 15), (190, 27), (225, 20)
sub_right = [bezier_point(p12, p13, p14, p15, i / 60.0) for i in range(61)]
sub_stem = sub_left + sub_right[1:]

for i in range(len(sub_stem) - 1):
    x1, y1 = sub_stem[i]
    x2, y2 = sub_stem[i+1]
    mid_x = (x1 + x2) / 2.0
    dist = abs(mid_x - 130)
    norm = min(1.0, dist / 95.0)
    alpha = int((1.0 - norm * 0.88) * 140)
    color = (35, 125, 108, max(12, alpha))
    draw.line([pt(x1, y1), pt(x2, y2)], fill=color, width=int(1.2 * scale))

# 叶片绘制函数
def draw_leaf(origin, angle_deg, length, width, fill_rgba, stroke_rgba):
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    ox, oy = origin
    pts = []
    steps = 28
    # top curve
    for i in range(steps + 1):
        t = i / steps
        lx = t * length
        ly = -math.sin(t * math.pi) * width
        rx = ox + lx * cos_a - ly * sin_a
        ry = oy + lx * sin_a + ly * cos_a
        pts.append(pt(rx, ry))
    # bottom curve
    for i in range(steps, -1, -1):
        t = i / steps
        lx = t * length
        ly = math.sin(t * math.pi) * (width * 0.88)
        rx = ox + lx * cos_a - ly * sin_a
        ry = oy + lx * sin_a + ly * cos_a
        pts.append(pt(rx, ry))
    draw.polygon(pts, fill=fill_rgba)
    draw.line(pts + [pts[0]], fill=stroke_rgba, width=int(1.0 * scale))
    # Leaf midrib (叶脉)
    mid_start = pt(ox, oy)
    mid_end = pt(ox + length * 0.75 * cos_a, oy + length * 0.75 * sin_a)
    draw.line([mid_start, mid_end], fill=(stroke_rgba[0], stroke_rgba[1], stroke_rgba[2], int(stroke_rgba[3]*0.6)), width=int(0.8 * scale))

# 小花朵绘制函数 (Petite 4 or 5-petal floret)
def draw_flower(center, radius, num_petals=5, petal_color=(23, 107, 93, 120), center_color=(217, 119, 54, 230)):
    cx, cy = center
    # Petals
    for p in range(num_petals):
        angle = (p * 360.0 / num_petals) + 18
        rad = math.radians(angle)
        px = cx + math.cos(rad) * (radius * 0.85)
        py = cy + math.sin(rad) * (radius * 0.85)
        draw.ellipse([pt(px - radius*0.55, py - radius*0.55), pt(px + radius*0.55, py + radius*0.55)],
                     fill=petal_color, outline=(23, 107, 93, 180), width=int(0.9 * scale))
    # Flower Center pistil
    draw.ellipse([pt(cx - radius*0.35, cy - radius*0.35), pt(cx + radius*0.35, cy + radius*0.35)], fill=center_color)

# ================= 丰富密集的花叶布置 =================

# 1. 中心主花簇与簇拥嫩芽
draw_flower((130, 20), radius=5.8, num_petals=5, petal_color=(23, 107, 93, 130), center_color=(217, 119, 54, 240))
# 中心上下一对嫩叶
draw_leaf((130, 14), 90, 11, 4.5, (23, 107, 93, 120), (23, 107, 93, 200))
draw_leaf((130, 26), 270, 11, 4.5, (23, 107, 93, 120), (23, 107, 93, 200))
# 中心斜向小花叶
draw_leaf((125, 17), 135, 9, 3.8, (23, 107, 93, 100), (23, 107, 93, 180))
draw_leaf((135, 23), 315, 9, 3.8, (23, 107, 93, 100), (23, 107, 93, 180))

# 2. 左侧丰富花草群 (Left wing botanicals)
# 紧邻中心的花苞
draw_flower((102, 16), radius=4.2, num_petals=4, petal_color=(45, 130, 110, 105), center_color=(225, 135, 60, 210))
# 叶片密集簇 1 (x=112~118)
draw_leaf((116, 18), 125, 12, 4.6, (23, 107, 93, 110), (23, 107, 93, 185))
draw_leaf((114, 21), 220, 10, 4.0, (23, 107, 93, 90), (23, 107, 93, 170))
# 叶片密集簇 2 (x=90~96)
draw_leaf((95, 15), 145, 13, 5.0, (23, 107, 93, 115), (23, 107, 93, 190))
draw_leaf((92, 17), 210, 11, 4.2, (23, 107, 93, 95), (23, 107, 93, 170))
# 左侧第二朵小花 (x=76)
draw_flower((76, 21), radius=3.8, num_petals=4, petal_color=(45, 130, 110, 95), center_color=(217, 119, 54, 200))
# 叶片密集簇 3 (x=78~65)
draw_leaf((80, 19), 65, 10, 3.8, (23, 107, 93, 95), (23, 107, 93, 165))
draw_leaf((68, 22), 160, 12, 4.5, (23, 107, 93, 90), (23, 107, 93, 160))
draw_leaf((64, 24), 225, 9, 3.6, (23, 107, 93, 75), (23, 107, 93, 145))
# 左侧第三朵嫩花苞 (x=48)
draw_flower((48, 18), radius=3.2, num_petals=4, petal_color=(45, 130, 110, 85), center_color=(217, 119, 54, 180))
# 左侧外延小叶簇 (x=45~30)
draw_leaf((46, 17), 130, 10, 3.6, (23, 107, 93, 80), (23, 107, 93, 150))
draw_leaf((36, 21), 170, 9, 3.2, (23, 107, 93, 65), (23, 107, 93, 130))
# 渐隐小露珠/微花粉 (Left dewdrops)
draw.ellipse([pt(24-1.8, 19-1.8), pt(24+1.8, 19+1.8)], fill=(23, 107, 93, 90))
draw.ellipse([pt(16-1.4, 20-1.4), pt(16+1.4, 20+1.4)], fill=(23, 107, 93, 50))
draw.ellipse([pt(86, 10), pt(88.5, 12.5)], fill=(217, 119, 54, 120))
draw.ellipse([pt(60, 29), pt(62.5, 31.5)], fill=(23, 107, 93, 70))

# 3. 右侧丰富花草群 (Right wing botanicals)
# 紧邻中心的花苞
draw_flower((158, 23), radius=4.2, num_petals=4, petal_color=(45, 130, 110, 105), center_color=(225, 135, 60, 210))
# 叶片密集簇 1 (x=142~148)
draw_leaf((144, 21), 55, 12, 4.6, (23, 107, 93, 110), (23, 107, 93, 185))
draw_leaf((146, 19), 320, 10, 4.0, (23, 107, 93, 90), (23, 107, 93, 170))
# 叶片密集簇 2 (x=165~172)
draw_leaf((166, 24), 35, 13, 5.0, (23, 107, 93, 115), (23, 107, 93, 190))
draw_leaf((169, 21), 330, 11, 4.2, (23, 107, 93, 95), (23, 107, 93, 170))
# 右侧第二朵小花 (x=184)
draw_flower((184, 18), radius=3.8, num_petals=4, petal_color=(45, 130, 110, 95), center_color=(217, 119, 54, 200))
# 叶片密集簇 3 (x=182~195)
draw_leaf((180, 20), 295, 10, 3.8, (23, 107, 93, 95), (23, 107, 93, 165))
draw_leaf((192, 17), 20, 12, 4.5, (23, 107, 93, 90), (23, 107, 93, 160))
draw_leaf((196, 15), 335, 9, 3.6, (23, 107, 93, 75), (23, 107, 93, 145))
# 右侧第三朵嫩花苞 (x=212)
draw_flower((212, 21), radius=3.2, num_petals=4, petal_color=(45, 130, 110, 85), center_color=(217, 119, 54, 180))
# 右侧外延小叶簇 (x=214~230)
draw_leaf((214, 22), 50, 10, 3.6, (23, 107, 93, 80), (23, 107, 93, 150))
draw_leaf((224, 19), 10, 9, 3.2, (23, 107, 93, 65), (23, 107, 93, 130))
# 渐隐小露珠/微花粉 (Right dewdrops)
draw.ellipse([pt(236-1.8, 20-1.8), pt(236+1.8, 20+1.8)], fill=(23, 107, 93, 90))
draw.ellipse([pt(244-1.4, 20-1.4), pt(244+1.4, 20+1.4)], fill=(23, 107, 93, 50))
draw.ellipse([pt(174, 30), pt(176.5, 32.5)], fill=(217, 119, 54, 120))
draw.ellipse([pt(200, 9), pt(202.5, 11.5)], fill=(23, 107, 93, 70))

# 4. 生成高精度抗锯齿 PNG (520 x 80)
final_img = img.resize((520, 80), Image.Resampling.LANCZOS)
final_img.save("miniprogram/assets/icons/floral-deco.png", "PNG")
print("New denser floral-deco.png generated successfully: 520x80")
