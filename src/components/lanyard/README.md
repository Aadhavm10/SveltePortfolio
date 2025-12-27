# Lanyard Component Assets

This folder requires two files to work properly:

1. **card.glb** - The 3D model of the ID card
2. **lanyard.png** - The texture for the lanyard strap

## Where to get these files:

You can create your own or download sample files from the original repository.

### For the card.glb file:
- You can edit the 3D model and change textures using this online editor:
  https://modelviewer.dev/editor/

### For the lanyard.png file:
- This is the texture for the lanyard strap
- You can create your own design in any image editor (Photoshop, Figma, etc.)
- Recommended size: 512x512px or higher

## Placement:

Place both files in this directory:
```
src/components/lanyard/
├── card.glb       (add this file)
├── lanyard.png    (add this file)
├── Lanyard.css
├── Lanyard.tsx
└── README.md
```

The component will automatically import them.
