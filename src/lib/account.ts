/**
 * Template account shape extensions. The fixture API returns licenses alongside
 * standard `AccountDTO` fields; this module types that extension and narrows API
 * responses for license-specific account pages.
 */
import type { AccountDTO } from "@bnomei/emdash-mika/types";

export interface MikaTemplateAccountLicense {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly displayKeySuffix?: string;
  readonly orderId?: string;
  readonly downloadHref?: string;
}

export type MikaTemplateAccountDTO = AccountDTO & {
  readonly licenses?: readonly MikaTemplateAccountLicense[];
};

/** Asserts the fixture license payload without re-fetching. */
export function mikaTemplateAccount(account: AccountDTO): MikaTemplateAccountDTO {
  return account as MikaTemplateAccountDTO;
}
