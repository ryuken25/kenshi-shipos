import Image from "next/image";

type VerseLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function VerseLogo({
  size = 36,
  className = "",
  priority = false,
}: VerseLogoProps) {
  return (
    <Image
      src="/brand/verse/verse-logo.svg"
      alt="VERSE"
      width={size}
      height={size}
      priority={priority}
      className={["shrink-0 object-contain", className].join(" ")}
    />
  );
}
