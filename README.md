# X Marks the Spot — Chest X-ray

An embeddable, single-file teaching simulator for the Rad-Lad website. It's the first plain-film sibling of
*The Scanogram* (CT) and *MR-I Ready* (MRI), using the same console layout and engine style. The radiographs are a
real, normal **PA and lateral chest pair from one patient** (CC0, see `CREDITS.md`). Your set-up is then simulated
onto them in the browser.

Marker: **Bread and Butter**. You earn it when both views score 45/50 or more on the first exposure, with no
repeats.

## Flow

1. **Request & checks.** Read the request (PA + lateral chest, 21-year-old woman, left chest pain after a football
   collision) and tick the pre-exposure checks: ID, justification, necklace off, top and bra off with a gown on,
   hair tied up. Anything left unticked shows up on the film as a necklace, bra hooks / underwire or hair over the
   apex.
2. **PA set-up (3-D room).** The patient stands at an erect chest stand, with a ceiling-suspended tube. You choose:
   - facing the detector (PA) or back to it (AP);
   - arm position: hands on hips with elbows forward / arms by the side / arms raised;
   - chin up or down;
   - SID 100 / 150 / 180 cm.

   The 3-D patient changes pose live. Drag the view to look around.
3. **Light beam.** You see the patient from the tube side: her back for the PA, her right side for the left lateral.
   This is the mirror image of the film. Then:
   - Drag the field to put the cross-wires (the central ray) on the spot.
   - Drag the edges to collimate. The collimator opens symmetrically.
   - Drop and drag an **L / R lead marker** onto the detector.
   - Optional: *Palpate* shows the landmarks (C7, inferior angles of the scapulae / T7, jugular notch, mid-axillary
     line), and *AEC* shows the three ionisation chambers.
4. **Exposure console.** Set kV, AEC (choose the chambers) or manual mAs, grid in or out, and the breathing
   instruction. Then **Expose**: the room lamp lights, the beam flashes, and the DR image is built.
5. **Review.** Shows DI / EI / DAP. **Accept**, or **Repeat**: you re-position, and the repeat costs 5 points plus the
   extra dose.
6. **Lateral.** The same steps, for the left side against the detector with arms raised.
7. **Debrief.** Both accepted films, image-quality criteria, a scored breakdown (50 per view) and total DAP.

### What is simulated on the real films

- Cropping to your field (DR shuttering).
- Magnification for SID and for AP / right-lateral set-ups (whole body plus extra heart magnification).
- Expiration: a warp that raises the diaphragms and broadens the heart.
- Scapulae over the lungs, arms over the lateral chest, and the jaw over the apices.
- Necklace, bra hooks / underwire, hair.
- Breathing motion blur.
- Exposure: kV contrast, no-grid fog, quantum noise when underexposed, burn-out when overexposed.
- Your lead marker.

Grading references (film mm, 0.25 mm/px) live in `assets/calib.json`:

- **PA:** centre on the midline at T7 (141, 160) ±15/25 mm. The field must include the apices, both lateral rib
  margins and the costophrenic angles, and must not reach the neck / abdomen / arms.
- **Lateral:** centre on the mid-axillary line at T7 (130, 180). The field must reach from the apices to the
  posterior costophrenic recesses, sternum to spine.
- **AEC:** the two outer chambers for the PA, the centre chamber for the lateral.

## Files

- `chest.embed.html` is the self-contained deliverable (~1.2 MB). `index.html` is an identical copy for one-drop
  hosting.
- `chest.html` is the source. It loads `assets/`, `assets/calib.js` and `room3d.js`. Run `python inline.py` to
  rebuild both deliverables.
- `room3d.js` is the procedural three.js X-ray room (three.js from jsDelivr). It contains:
  - the erect stand with the AEC-marked detector and the overhead grip;
  - the ceiling tube with an SID display;
  - the light-beam diaphragm, a projected-texture spotlight;
  - a standing patient with PA / AP / lateral and arm / chin poses;
  - the exposure flash.

  If you change it, bump `?v=N` in `chest.html` **and** `inline.py` together.
- `assets/`:
  - `pa.jpg`, `lat.jpg`: the prepared films.
  - `*_x.jpg`: the films with an 8 cm synthetic margin, which is what the sim samples.
  - `*_t.jpg`: title thumbnails.
  - `calib.json` / `calib.js`: geometry, landmarks, tolerances.
  - The logos.
- `assets/src/` holds the untouched Wikimedia originals. Run `tools/prep_assets.py` (from inside `assets/`) to rebuild
  the prepared films from them.

Debug hooks: `window.__xr` (`S()`, `cur()`, `startProj(p)`, `gotoCentre()`, `gotoExpose()`, `ideal()`, `expose()`,
`accept()`, `grade(p, shot)`, `parse(cmd)`) and `window.__room()`.
