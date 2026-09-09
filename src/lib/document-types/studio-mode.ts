import type { DocumentTypeVersionSnapshot } from "@/types/document-type";

export function snapshotUsesAdvancedRules(
  snapshot: DocumentTypeVersionSnapshot,
) {
  if (
    snapshot.formSchema.groups.some(
      (group) =>
        Boolean(group.visibleWhen) ||
        group.fields.some(
          (field) =>
            Boolean(field.visibleWhen) ||
            (field.type === "select" &&
              field.options.some(
                (option) => (option.activatesGroupIds ?? []).length > 0,
              )),
        ),
    )
  ) {
    return true;
  }
  return snapshot.template.blocks.some(
    (block) =>
      Boolean(block.includeWhen) ||
      (block.children ?? []).some((child) => child.type === "variantMap"),
  );
}
