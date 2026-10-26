"""Prepare the chest X-ray assets from the CC0 Wikimedia originals in assets/src.
   - PA: inpaint the burnt-in 'Dx' / 'Sin' labels (the sim places its own lead marker)
   - both: greyscale, resized x0.6 (estimated 0.15 mm/px -> 0.25 mm/px), JPEG q90
   - prints skin-edge profiles used to fit the light-field silhouettes"""
import cv2, numpy as np, json, sys
S = 0.6
pa = cv2.imread("src/pa.jpg", cv2.IMREAD_GRAYSCALE)
mask = np.zeros_like(pa)
for (x0, y0, x1, y1) in [(100, 55, 235, 155), (1535, 10, 1700, 112)]:
    roi = pa[y0:y1, x0:x1]
    mask[y0:y1, x0:x1] = (roi > 200).astype(np.uint8)*255
mask = cv2.dilate(mask, np.ones((7, 7), np.uint8), 2)
print("label px", int((mask > 0).sum()))
pa = cv2.inpaint(pa, mask, 9, cv2.INPAINT_TELEA)
# re-grain the inpainted patch so it doesn't look smooth
rng = np.random.default_rng(3)
g = rng.normal(0, 2.2, pa.shape)
m = cv2.GaussianBlur(mask.astype(float)/255, (9, 9), 3)
pa = np.clip(pa + g*m, 0, 255).astype(np.uint8)
lat = cv2.imread("src/lat.jpg", cv2.IMREAD_GRAYSCALE)
out = {}
for n, im in [("pa", pa), ("lat", lat)]:
    r = cv2.resize(im, (round(im.shape[1]*S), round(im.shape[0]*S)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(n + ".jpg", r, [cv2.IMWRITE_JPEG_QUALITY, 90])
    out[n] = r.shape[::-1]
    sm = cv2.GaussianBlur(r, (0, 0), 3)
    print(n, r.shape[::-1])
    for y in range(0, r.shape[0], r.shape[0]//16):
        row = sm[y]
        print("  y%5d" % y, " ".join("%3d" % v for v in row[::max(1, r.shape[1]//24)]))
print(json.dumps(out))

# ---- padded copies: the sim lets the light field open wider than the original film, so the film is extended
#      by PAD px each side with a progressively blurred edge-replicate (flagged in CREDITS as synthetic) ----
PAD = 320                                    # 80 mm at 0.25 mm/px
for n in ("pa", "lat"):
    im = cv2.imread(n + ".jpg", cv2.IMREAD_GRAYSCALE).astype(np.float32)
    B = 8                                     # the film's own edge rows/cols carry a dark border: don't replicate them
    core = im[B:-B, B:-B]
    ext = cv2.copyMakeBorder(core, PAD+B, PAD+B, PAD+B, PAD+B, cv2.BORDER_REPLICATE)
    ext[PAD:PAD+im.shape[0], PAD:PAD+im.shape[1]] = im
    h, w = im.shape
    yy, xx = np.mgrid[0:ext.shape[0], 0:ext.shape[1]]
    dx = np.maximum(0, np.maximum(PAD - xx, xx - (PAD + w - 1)))
    dy = np.maximum(0, np.maximum(PAD - yy, yy - (PAD + h - 1)))
    d = np.sqrt(dx*dx + dy*dy)                # distance outside the real film, px
    out = ext.copy()
    for s in (6, 16, 36, 70):                 # blend in heavier blur further out
        b = cv2.GaussianBlur(ext, (0, 0), s)
        wgt = np.clip(d/(s*5.0), 0, 1)
        out = out*(1 - wgt) + b*wgt
    out = out*(1 - 0.18*np.clip(d/PAD, 0, 1))  # fade a little toward the edge
    noise = np.random.default_rng(5).normal(0, 2.0, out.shape)*np.clip(d/40, 0, 1)
    cv2.imwrite(n + "_x.jpg", np.clip(out + noise, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(n, "padded", out.shape[::-1])
