import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listClients, getClient, listBankAccounts } from "@/lib/api/clients";
import { listLoans, listClientLoans, getSchedule } from "@/lib/api/loans";
import { listSubscriptions, listPlans, listCoupons, listClientSubscriptions } from "@/lib/api/memberships";
import { listMovements, listClientMovements } from "@/lib/api/movements";
import { listPending } from "@/lib/api/pending";
import { getDashboard } from "@/lib/api/dashboard";
import { listActivity, listEntityActivity } from "@/lib/api/activity";
import { listBackofficeUsers } from "@/lib/api/backoffice";
import { listBanks, listRejectionReasons } from "@/lib/api/catalogs";
import { checkIntegrations } from "@/lib/api/integrations";
import {
  listCampaigns,
  listRecipients,
  listCardRequests,
  listCards,
  listClientCards,
  listCardMovements,
  getMasterAccount,
  listMasterMovements,
} from "@/lib/api/cards";
import type { Loan } from "@/lib/api/types";

export const QK = {
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  bankAccounts: (id: string) => ["clients", id, "bank-accounts"] as const,
  loans: ["loans"] as const,
  clientLoans: (id: string) => ["loans", "client", id] as const,
  schedule: (id: string) => ["loans", id, "schedule"] as const,
  subscriptions: ["subscriptions"] as const,
  clientSubscriptions: (id: string) => ["subscriptions", "client", id] as const,
  plans: ["plans"] as const,
  coupons: ["coupons"] as const,
  movements: ["movements"] as const,
  clientMovements: (id: string) => ["movements", "client", id] as const,
  pending: ["pending"] as const,
  dashboard: ["dashboard"] as const,
  activity: ["activity"] as const,
  entityActivity: (id: string) => ["activity", id] as const,
  backoffice: ["backoffice"] as const,
  banks: ["banks"] as const,
  reasons: ["reasons"] as const,
  integrations: ["integrations"] as const,
  campaigns: ["campaigns"] as const,
  recipients: (id?: string) => ["campaigns", "recipients", id ?? "all"] as const,
  cardRequests: ["cards", "requests"] as const,
  cards: ["cards"] as const,
  clientCards: (id: string) => ["cards", "client", id] as const,
  cardMovements: (id: string) => ["cards", id, "movements"] as const,
  master: ["cards", "master"] as const,
  masterMovements: ["cards", "master", "movements"] as const,
};

const stale = { staleTime: 60_000 };

export const useClients = () => useQuery({ queryKey: QK.clients, queryFn: listClients, ...stale });
export const useClient = (id: string) => useQuery({ queryKey: QK.client(id), queryFn: () => getClient(id), ...stale });
export const useBankAccounts = (id: string) => useQuery({ queryKey: QK.bankAccounts(id), queryFn: () => listBankAccounts(id), ...stale });
export const useLoans = () => useQuery({ queryKey: QK.loans, queryFn: listLoans, ...stale });
export const useClientLoans = (id: string) => useQuery({ queryKey: QK.clientLoans(id), queryFn: () => listClientLoans(id), ...stale });
export const useSchedule = (loan: Loan | null) =>
  useQuery({ queryKey: QK.schedule(loan?.id ?? "none"), queryFn: () => getSchedule(loan as Loan), enabled: !!loan, ...stale });
export const useSubscriptions = () => useQuery({ queryKey: QK.subscriptions, queryFn: listSubscriptions, ...stale });
export const useClientSubscriptions = (id: string) =>
  useQuery({ queryKey: QK.clientSubscriptions(id), queryFn: () => listClientSubscriptions(id), ...stale });
export const usePlans = () => useQuery({ queryKey: QK.plans, queryFn: () => listPlans(true), ...stale });
export const useCoupons = () => useQuery({ queryKey: QK.coupons, queryFn: listCoupons, ...stale });
export const useMovements = () => useQuery({ queryKey: QK.movements, queryFn: listMovements, ...stale });
export const useClientMovements = (id: string, name: string) =>
  useQuery({ queryKey: QK.clientMovements(id), queryFn: () => listClientMovements(id, name), ...stale });
export const usePending = () => useQuery({ queryKey: QK.pending, queryFn: listPending, ...stale });
export const useDashboard = () => useQuery({ queryKey: QK.dashboard, queryFn: getDashboard, ...stale });
export const useActivity = () => useQuery({ queryKey: QK.activity, queryFn: listActivity, ...stale });
export const useEntityActivity = (id: string) => useQuery({ queryKey: QK.entityActivity(id), queryFn: () => listEntityActivity(id), ...stale });
export const useBackofficeUsers = () => useQuery({ queryKey: QK.backoffice, queryFn: listBackofficeUsers, ...stale });
export const useBanks = () => useQuery({ queryKey: QK.banks, queryFn: listBanks, staleTime: 10 * 60_000 });
export const useRejectionReasons = () => useQuery({ queryKey: QK.reasons, queryFn: listRejectionReasons, staleTime: 10 * 60_000 });
export const useIntegrations = () => useQuery({ queryKey: QK.integrations, queryFn: checkIntegrations, staleTime: 30_000 });
export const useCampaigns = () => useQuery({ queryKey: QK.campaigns, queryFn: listCampaigns, ...stale });
export const useRecipients = (id?: string) => useQuery({ queryKey: QK.recipients(id), queryFn: () => listRecipients(id), ...stale });
export const useCardRequests = () => useQuery({ queryKey: QK.cardRequests, queryFn: listCardRequests, ...stale });
export const useCards = () => useQuery({ queryKey: QK.cards, queryFn: listCards, ...stale });
export const useClientCards = (id: string) => useQuery({ queryKey: QK.clientCards(id), queryFn: () => listClientCards(id), ...stale });
export const useCardMovements = (id: string | null) =>
  useQuery({ queryKey: QK.cardMovements(id ?? "none"), queryFn: () => listCardMovements(id as string), enabled: !!id, ...stale });
export const useMasterAccount = () => useQuery({ queryKey: QK.master, queryFn: getMasterAccount, ...stale });
export const useMasterMovements = () => useQuery({ queryKey: QK.masterMovements, queryFn: listMasterMovements, ...stale });

/** Invalida todo lo que depende de una acción (préstamos, clientes, pendientes, dashboard, movimientos). */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["loans", "clients", "pending", "dashboard", "movements", "subscriptions", "activity", "cards", "campaigns", "backoffice", "plans", "coupons", "reasons", "banks"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}
