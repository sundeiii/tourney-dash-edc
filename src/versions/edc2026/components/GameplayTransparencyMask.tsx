type Area = { x: number; y: number; width: number; height: number };

type Props = {
  image: string;
  area: Area;
  // unique per mounted mask: url(#id) resolves to the first matching id in the page
  maskId: string;
};

export function GameplaySvgMask({ image, area, maskId }: Props) {
  return (
    <svg
      className="bg-mask"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={area.x}
            y={area.y}
            width={area.width}
            height={area.height}
            fill="black"
          />
        </mask>
      </defs>

      <image
        href={image}
        x="0"
        y="0"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
