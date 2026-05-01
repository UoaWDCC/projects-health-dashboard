# Tailwind

## Colours

Custom colour classes are prefixed with `wdcc`. For example, `text-wdcc-oshan` applies the colour `#1F2031` to text.
Blue and grey each have two variants (normal and light): `wdcc-grey-light`, `wdcc-grey`, `wdcc-blue-light`, and `wdcc-blue`.

> [!NOTE]
> Grey colours are not shown in the colour palette on Figma, but are used in the design. Make sure you used the correct grey variant according to the Figma design.

[**tailwind.config.ts**](https://github.com/UoaWDCC/projects-health-dashboard/blob/main/apps/web/tailwind.config.ts)

```ts
colors: {
  wdcc: {
    // Light colours
    purple: '#E9CFFC',
    peach: '#FDE6CF',
    mint: '#D4F7ED',

    // Dark colours
    blue: {
      light: '#CFE0FD',
      DEFAULT: '#077CF1',
    },
    orange: '#FFB05F',
    kelvin: '#E333A3', // pink
    grey: {
      light: '#9A9EB8',
      DEFAULT: '#5A5E7A',
    },
    oshan: '#1F2031', // blac
  },
},
```

A visual reference for the colours is available in Figma, or you can use the tables below.

### Light Colours

| Name              | Hex Code | Visual                                                                                                   |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `wdcc-blue-light` | #CFE0FD  | <img width="50" height="50" alt="wdcc-blue-light" src="https://singlecolorimage.com/get/CFE0FD/50x50" /> |
| `wdcc-purple`     | #E9CFFC  | <img width="50" height="50" alt="wdcc-purple" src="https://singlecolorimage.com/get/E9CFFC/50x50" />     |
| `wdcc-peach`      | #FDE6CF  | <img width="50" height="50" alt="wdcc-peach" src="https://singlecolorimage.com/get/FDE6CF/50x50" />      |
| `wdcc-mint`       | #D4F7ED  | <img width="50" height="50" alt="wdcc-mint" src="https://singlecolorimage.com/get/D4F7ED/50x50" />       |
| `wdcc-grey-light` | #9A9EB8  | <img width="50" height="50" alt="wdcc-grey-light" src="https://singlecolorimage.com/get/9A9EB8/50x50" /> |

### Dark Colours

| Name          | Hex Code | Visual                                                                                               |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `wdcc-blue`   | #077CF1  | <img width="50" height="50" alt="wdcc-blue" src="https://singlecolorimage.com/get/077CF1/50x50" />   |
| `wdcc-orange` | #FFB05F  | <img width="50" height="50" alt="wdcc-orange" src="https://singlecolorimage.com/get/FFB05F/50x50" /> |
| `wdcc-kelvin` | #E333A3  | <img width="50" height="50" alt="wdcc-kelvin" src="https://singlecolorimage.com/get/E333A3/50x50" /> |
| `wdcc-oshan`  | #1F2031  | <img width="50" height="50" alt="wdcc-oshan" src="https://singlecolorimage.com/get/1F2031/50x50" />  |
| `wdcc-grey`   | #5A5E7A  | <img width="50" height="50" alt="wdcc-grey" src="https://singlecolorimage.com/get/5A5E7A/50x50" />   |
