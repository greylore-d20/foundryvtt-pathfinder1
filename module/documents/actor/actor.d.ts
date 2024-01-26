interface RechargeActorItemsOptions
  extends Exclude<Partial<NonNullable<Parameters<pf1.documents.item.ItemPF["recharge"]>[0]>>, "commit"> {
  /**
   * If false, return update data object instead of directly updating the actor.
   *
   * @defaultValue `true`
   */
  commit?: boolean;
  /**
   * Update data to complement or read changed values from.
   *
   * @defaultValue `{}`
   */
  updateData: Record<string, unknown>;
}
