import type { User } from "@pulse/contracts";
import { OptionSelect } from "@/components/form/option-select";
import { useUpdateResource } from "@/lib/query/use-resource-mutations";
import { memberResource } from "../api/member-resource";
import { assignableRoleOptions } from "../role-meta";

export const RoleSelect = ({ member }: { member: User }) => {
  const updateRole = useUpdateResource(memberResource, {
    optimistic: true,
    successMessage: (updated) => `${updated.name} is now ${updated.role}`,
  });

  return (
    <OptionSelect
      value={member.role}
      options={assignableRoleOptions}
      onChange={(role) => updateRole.mutate({ id: member.id, input: { role } })}
      disabled={updateRole.isPending}
      className="w-32"
      aria-label={`Role for ${member.name}`}
    />
  );
};
