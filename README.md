# Just make them touch (for Figma)

A Figma plugin that closes the distance between two paths so them touch, not just their bounding boxes.

**[Plugin's page ↗︎](https://www.figma.com/community/plugin/1568768697498818615)**

When adjusting layers in Figma, the distance is calculated from their bounding boxes, not their actual shapes. This plugin bridges that gap by calculating the distance based on the vector paths themselves.

### What it does

- Finds the outermost vertex of one path, calculates the intersection point on the other, and then closes the distance between them.
- Works horizontally or vertically, automatically detecting your intention based on the paths positions.

**Note:** Curved segments are not supported at this time.

### How to Use

1. Select two vector paths that are flattened and have no stroke.
2. Run the plugin: `Plugins → Just make them touch`.
3. Your paths are now touching.
4. You can select another pair of paths and click `Make it touch` again to adjust the spacing of more paths without reopening the plugin.

---

Report bugs by creating an issue.
