import { Avatar, AvatarFallback } from "@pulse/ui/components/avatar";
import { getInitials } from "@/lib/format/text";

const HUE_COUNT = 360;

const getHue = (name: string) =>
  [...name].reduce((sum, character) => sum + character.charCodeAt(0) * 7, 0) %
  HUE_COUNT;

export const UserAvatar = ({ name }: { name: string }) => {
  const hue = getHue(name);

  return (
    <Avatar className="size-8 rounded-lg after:rounded-lg">
      <AvatarFallback
        className="rounded-lg text-xs font-semibold"
        style={{
          backgroundColor: `oklch(0.9 0.09 ${hue})`,
          color: `oklch(0.32 0.1 ${hue})`,
        }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};
