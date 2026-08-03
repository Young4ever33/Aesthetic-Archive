# Aesthetic Archive MVP QA Checklist

Use this checklist before migrating the MVP to Next.js / Supabase.

Preview URL:

```text
http://127.0.0.1:5173/
```

## 0. Smoke Test

- [ ] Page loads without console-blocking JavaScript errors.
- [ ] Marketing view opens first.
- [ ] Hero title is `别再只是收藏参考图，开始搭建你的审美知识库。`.
- [ ] Login button opens local login panel.
- [ ] CTA enters the app view.
- [ ] Left sidebar is the only functional navigation in app view.
- [ ] Chinese / English language menu opens and persists selection.

## 1. Public Plaza

- [ ] Public Plaza renders seed cards.
- [ ] Search filters cards.
- [ ] Category filters work.
- [ ] Quick style chips work and show active state.
- [ ] Clear resets all filters.
- [ ] Empty state appears for no results.
- [ ] Export Markdown downloads current filtered results.
- [ ] Export JSON downloads current filtered results.
- [ ] Save stores a card in Saved.
- [ ] Copy creates an editable private card in My Archive.
- [ ] + Collage adds a card to Collage Board.
- [ ] Clicking a card opens detail panel.

## 2. Detail Panel

- [ ] Detail panel opens without layout overflow.
- [ ] Left gallery preserves image proportions.
- [ ] Thumbnail switching works.
- [ ] Prompt ZH appears in first screen and uses orange styling.
- [ ] Prompt EN appears in first screen and uses blue styling.
- [ ] Copy ZH works.
- [ ] Copy EN works.
- [ ] Save works from detail.
- [ ] Copy to My Archive works for public cards.
- [ ] Edit private case works for private cards.
- [ ] Add to Collage works.
- [ ] Export downloads detail Markdown.
- [ ] Escape closes detail.

## 3. My Archive

- [ ] Creating a card without title shows visible validation warning.
- [ ] Creating a card without image is allowed with warning.
- [ ] Uploading one image previews and compresses it.
- [ ] Uploading multiple images previews multiple images.
- [ ] Data URLs remain intact and are not split by commas.
- [ ] AI Analyze Image with no Provider generates local draft.
- [ ] AI Analyze Image with Provider selected attempts real Provider call.
- [ ] Provider failure falls back to local draft.
- [ ] Save aesthetic card persists the card.
- [ ] New Card clears form and exits edit state.
- [ ] Reset / Cancel edit clears form and exits edit state.
- [ ] Clear Image clears only images.
- [ ] Edit private card loads form data.
- [ ] Update private card syncs Saved and Collage references.
- [ ] Delete private card removes it from My Archive, Saved, and Collage.
- [ ] Optimize Images reduces local image pressure.
- [ ] Remove Images removes local data URL images but keeps text/prompt.
- [ ] Export Markdown works.
- [ ] Export JSON works.
- [ ] Clear archive works.

## 4. Publish Review Flow

- [ ] Saving with Private keeps card private.
- [ ] Saving with Submit for Review creates pending status.
- [ ] Pending card does not appear in Public Plaza.
- [ ] Approve changes status to Published.
- [ ] Published private card appears in Public Plaza.
- [ ] Reject changes status to Rejected.
- [ ] Rejected card does not appear in Public Plaza.
- [ ] Unpublish removes published card from Public Plaza.
- [ ] Archive card badges show Private / Pending Review / Published / Rejected.
- [ ] Storage health Published count only counts published cards.

## 5. Saved

- [ ] Saved count updates.
- [ ] Saved cards render.
- [ ] Removing saved card works.
- [ ] Clear saved works.
- [ ] Saved card opens detail panel.
- [ ] Saved private cards remain accessible while source private card exists.

## 6. AI Provider

- [ ] Provider page renders empty provider list state.
- [ ] Saving Provider requires API key.
- [ ] image-capable Provider requires at least one image model.
- [ ] Can save OpenAI Provider.
- [ ] Can save Gemini Provider.
- [ ] Can save OpenRouter Provider.
- [ ] Can save Custom Endpoint Provider.
- [ ] Can add multiple Providers.
- [ ] Can edit Provider.
- [ ] Can set default Provider.
- [ ] Can delete Provider.
- [ ] Provider card shows image-capable marker.
- [ ] My Archive Provider dropdown updates after saving Provider.
- [ ] Image Model dropdown updates based on selected Provider.
- [ ] Local fallback can be selected.
- [ ] Image Processing API fields save and reload.

## 7. Collage Board

- [ ] + Collage creates image node.
- [ ] Duplicate image node works.
- [ ] Move image node works.
- [ ] Resize image node works.
- [ ] Bring front works.
- [ ] Send back works.
- [ ] Delete / Backspace removes selected node.
- [ ] Escape clears selected node.
- [ ] Undo works.
- [ ] Redo works.
- [ ] Text tool creates transparent text node.
- [ ] Text node can be edited.
- [ ] Text node move handle works.
- [ ] Text node resize works.
- [ ] Text color works.
- [ ] Text weight works.
- [ ] Sticky tool creates sticky node.
- [ ] Sticky node can be edited.
- [ ] Sticky move handle works.
- [ ] Sticky resize works.
- [ ] Sticky background color works.
- [ ] Sticky text color works.
- [ ] Sticky weight works.
- [ ] Pen draws over blank canvas.
- [ ] Pen draws over image nodes.
- [ ] Pen pointer coordinates are accurate.
- [ ] Pen color works.
- [ ] Pen size works.
- [ ] Clear last stroke works.
- [ ] Board state persists after reload.
- [ ] Export Markdown works.
- [ ] Export JSON works.
- [ ] Clear Board works.

## 8. Board AI Summary

- [ ] Generate Summary works without Provider and uses local summary.
- [ ] Generate Summary uses text Provider when configured.
- [ ] Provider failure falls back to local summary.
- [ ] Generated summary is saved to board data.
- [ ] Summary remains visible after reload.

## 9. Image Tools

- [ ] Selected image shows Image URL field.
- [ ] Replacing Image URL updates selected image.
- [ ] Extract Palette works for local data URL image.
- [ ] Extract Palette shows CORS warning for blocked remote images.
- [ ] Extracted palette appears in Inspector.
- [ ] Remove BG without image API Provider shows setup warning.
- [ ] Remove BG with remove.bg config attempts API call.
- [ ] Remove BG with Clipdrop config attempts API call.
- [ ] Remove BG with custom endpoint accepts returned image/dataUrl/url.
- [ ] Failed Remove BG shows visible error toast.

## 10. LocalStorage / Data Safety

- [ ] No silent save failure when title missing.
- [ ] No silent save failure when quota is exceeded.
- [ ] Failed save keeps form data.
- [ ] localStorage keys match release notes.
- [ ] Export JSON provides migration path before clearing browser data.

## 11. Migration Readiness

- [ ] Current MVP feature map is captured in `docs/MVP_RELEASE_NOTES.md`.
- [ ] Known limitations are documented.
- [ ] Current localStorage schemas are documented.
- [ ] Seed cases and legacy image paths are retained.
- [ ] Next architecture plan is ready before starting the migration.
