/**
 * Tipos de dominio del backoffice de Increscendo Fintech.
 *
 * Mapean la base actual de Increscendo (Supabase): users, loans, loan_disbursements,
 * loan_documents, loan_signatures, user_memberships, membership_plans, coupons,
 * payment_methods, invoices, notifications, app_settings.
 *
 * Los campos marcados como "metadata" se guardan hoy en las columnas JSON
 * `users.metadata` / `loans.metadata` mientras el backend crea columnas propias.
 * Ver docs/CONTRATOS_BACKEND.md.
 */

/* ───────────────────────── Clientes ───────────────────────── */

export type PersonType = "fisica" | "moral";

/** Estatus de identidad (KYC) a nivel cliente. Lo heredan tarjeta y préstamo. */
export type KycStatus = "incompleto" | "por_verificar" | "verificado" | "rechazado";

export type AddressParts = {
  calle?: string;
  numero?: string;
  colonia?: string;
  ciudad?: string;
  estado?: string;
  pais?: string;
  cp?: string;
};

export type ClientDocuments = {
  ineFrontUrl?: string | null;
  ineBackUrl?: string | null;
  curpUrl?: string | null;
  selfieUrl?: string | null;
  contractUrl?: string | null;
  rfcUrl?: string | null;
  addressProofUrl?: string | null;
};

export type KycReview = {
  status: KycStatus;
  /** Código del catálogo de motivos de rechazo (Sistema › Catálogos). */
  reasonCode?: string | null;
  reasonMessage?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export type Client = {
  id: string;
  code: string;
  personType: PersonType;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  rfc: string;
  curp: string;
  ineKey: string;
  birthDate: string | null;
  address: string;
  addressParts: AddressParts;
  createdAt: string;
  avatarUrl?: string | null;
  documents: ClientDocuments;
  kyc: KycReview;
  /** Ejecutivo (usuario backoffice) que dio de alta al cliente. */
  executiveId: string | null;
  executiveName: string | null;
  /** Préstamo por invitación: solo los elegibles ven la opción en su app. */
  loanEligible: boolean;
  /** Proveedor de domiciliación según su banco. */
  collectionProvider: "belvo" | "druo" | null;
  membership: ClientMembershipSummary | null;
  loansTotal: number;
  loansActive: number;
  hasCard: boolean;
};

export type ClientMembershipSummary = {
  id: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
};

export type BankAccount = {
  id: string;
  bankName: string;
  clabe: string;
  lastDigits: string;
  validationStatus: string;
  isDefault: boolean;
  provider: "belvo" | "druo" | null;
  createdAt: string;
  kind: "cuenta" | "tarjeta";
};

/* ───────────────────────── Préstamos ───────────────────────── */

export type LoanDbStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "signed"
  | "disbursed"
  | "active"
  | "paid"
  | "closed"
  | "cancelled"
  | "rejected";

/** Etapa operativa (pestaña) derivada del estatus en BD. */
export type LoanStage = "solicitud" | "firma" | "desembolso" | "activo" | "cerrado";

export type Loan = {
  id: string;
  folio: string;
  userId: string;
  clientName: string;
  email: string;
  phone: string;
  ineKey: string;
  curp: string;
  amount: number;
  installments: number;
  monthlyPayment: number;
  interestRate: number;
  totalToPay: number;
  dbStatus: LoanDbStatus;
  stage: LoanStage;
  consentStatus: string | null;
  membershipName: string;
  appliedAt: string | null;
  approvedAt: string | null;
  signedAt: string | null;
  disbursedAt: string | null;
  paidAmount: number;
  paidInstallments: number;
  nextPaymentDate: string | null;
  lastPaymentDate: string | null;
  /** Días de atraso de la cuota vencida más antigua (0 si al día). */
  daysOverdue: number;
  bank: string;
  clabe: string;
  signatureStatus: "Espera" | "Firmado" | "Error";
  disbursementStatus: "Pendiente" | "Desembolsado";
  rejection: { code: string; message: string } | null;
  notices: CollectionNotice[];
  portfolioSold: boolean;
  metadata: Record<string, unknown>;
};

export type CollectionNotice = {
  sentAt: string;
  sentBy: string | null;
  channel: "email";
  installment: number | null;
};

export type InstallmentStatus =
  | "pagado"
  | "pendiente"
  | "en_proceso"
  | "rechazado"
  | "cancelado"
  | "contracargo"
  | "atrasado";

export type Installment = {
  number: number;
  dueDate: string | null;
  amount: number;
  status: InstallmentStatus;
  paidAt: string | null;
  paymentRequestId: string | null;
  failedReason: string | null;
};

export type LoanSchedule = {
  source: "belvo" | "calculado";
  installments: Installment[];
  totalPaid: number;
};

/* ───────────────────────── Membresías ───────────────────────── */

export type SubscriptionStatus = "active" | "expired" | "pending" | "cancelled";

export type Subscription = {
  id: string;
  userId: string;
  clientName: string;
  email: string;
  planId: string;
  planName: string;
  price: number;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  daysToExpire: number | null;
};

export type MembershipPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  active: boolean;
  benefits: string[];
  targetAudience: string;
  interestRate: number | null;
  /** Si el plan da acceso a tarjeta prepago (pendiente de confirmar con Héctor). */
  includesCard: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  startsAt: string | null;
  endsAt: string | null;
};

/* ───────────────────────── Movimientos ───────────────────────── */

export type MovementType =
  | "pago_membresia"
  | "renovacion_membresia"
  | "desembolso_prestamo"
  | "cuota_programada"
  | "cobro_bajo_demanda"
  | "reembolso"
  | "contracargo"
  | "recarga_tarjeta"
  | "consumo_tarjeta"
  | "pago_servicio"
  /** Reservado para la fase de cuentas SPEI / transferencias. */
  | "transferencia";

export type MovementStatus = "exitoso" | "en_proceso" | "fallido" | "cancelado" | "reembolsado";

export type MovementProvider = "conekta" | "respaldo" | "belvo" | "druo" | "onecard" | "tekae" | "manual";

export type Movement = {
  id: string;
  date: string;
  userId: string | null;
  clientName: string;
  type: MovementType;
  product: "membresia" | "prestamo" | "tarjeta" | "servicio" | "transferencia";
  direction: "entrada" | "salida";
  amount: number;
  status: MovementStatus;
  provider: MovementProvider;
  method: string;
  reference: string;
  description: string;
  relatedId: string | null;
  failedReason: string | null;
};

/* ───────────────────────── Pendientes ───────────────────────── */

export type PendingKind =
  | "kyc"
  | "solicitud_prestamo"
  | "firma"
  | "desembolso"
  | "cuota_atrasada"
  | "membresia_por_vencer"
  | "tarjeta_solicitud"
  | "tarjeta_reportada"
  | "cobro_sin_cliente";

export type PendingItem = {
  id: string;
  kind: PendingKind;
  title: string;
  detail: string;
  clientName: string;
  userId: string | null;
  relatedId: string | null;
  createdAt: string;
  priority: "alta" | "media" | "baja";
  assignee: string | null;
  link: string;
};

/* ───────────────────────── Tarjetas (OneCard) ───────────────────────── */

export type CampaignRecipientStatus =
  | "enviada"
  | "abierta"
  | "identidad"
  | "membresia"
  | "en_revision"
  | "aprobada"
  | "rechazada"
  | "contrato"
  | "lista"
  | "activa"
  | "expirada";

export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  recipients: number;
  opened: number;
  completed: number;
  activated: number;
  expiresAt: string;
  status: "enviando" | "activa" | "cerrada";
};

export type CampaignRecipient = {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  email: string;
  phone: string;
  status: CampaignRecipientStatus;
  updatedAt: string;
  tokenExpiresAt: string;
};

export type CardRequestStatus = "por_revisar" | "error_onecard" | "aprobada" | "rechazada";

export type CardRequest = {
  id: string;
  userId: string;
  clientName: string;
  email: string;
  membershipName: string;
  kycStatus: KycStatus;
  requestedAt: string;
  creditLine: number;
  status: CardRequestStatus;
  errorMessage: string | null;
  campaignName: string | null;
};

export type CardStatus = "activa" | "bloqueada" | "bloqueo_temporal" | "reportada" | "reemplazada" | "pendiente_entrega";

export type Card = {
  id: string;
  userId: string;
  clientName: string;
  lastDigits: string;
  kind: "fisica" | "virtual";
  status: CardStatus;
  balance: number;
  creditLine: number;
  onlinePurchases: boolean;
  issuedAt: string;
  deliveredAt: string | null;
  reportedAt: string | null;
  reportReason: "robo" | "extravio" | null;
  replacementOf: string | null;
};

export type CardMovement = {
  id: string;
  cardId: string;
  date: string;
  description: string;
  amount: number;
  type: "compra" | "retiro" | "recarga" | "comision" | "devolucion";
};

export type MasterAccount = {
  balance: number;
  assignedToday: number;
  assignedMonth: number;
  lastSyncAt: string;
};

export type MasterMovement = {
  id: string;
  date: string;
  clientName: string;
  cardLast: string;
  amount: number;
  kind: "carga_inicial" | "recarga" | "fondeo" | "ajuste";
  by: string;
};

/* ───────────────────────── Backoffice ───────────────────────── */

export type BackofficeRole = "admin" | "operaciones" | "agente" | "cobranza" | "lectura" | "tecnico";

export type BackofficeUser = {
  id: string;
  name: string;
  email: string;
  role: BackofficeRole;
  active: boolean;
  location: string | null;
  lastAccessAt: string | null;
  clientsRegistered: number;
};

export type ActivityEntry = {
  id: string;
  at: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
};

export type RejectionReason = {
  code: string;
  label: string;
  /** Mensaje orientador que verá el cliente. */
  clientMessage: string;
  appliesTo: ("identidad" | "prestamo" | "tarjeta")[];
  /** Códigos de Belvo que se traducen a este motivo. */
  belvoCodes: string[];
};

export type Bank = {
  id: string;
  name: string;
  provider: "belvo" | "druo";
  source: "belvo" | "manual";
  active: boolean;
};

export type IntegrationHealth = {
  key: "belvo" | "druo" | "conekta" | "signnow" | "tekae" | "onecard" | "supabase";
  name: string;
  purpose: string;
  status: "ok" | "degradado" | "caido" | "sin_configurar" | "desconocido";
  latencyMs: number | null;
  checkedAt: string | null;
  detail: string;
};

export type EmailTemplate = {
  key: string;
  name: string;
  subject: string;
  trigger: string;
  automatic: boolean;
  enabled: boolean;
};

/* ───────────────────────── Paginación ───────────────────────── */

export type Paged<T> = { rows: T[]; total: number };
