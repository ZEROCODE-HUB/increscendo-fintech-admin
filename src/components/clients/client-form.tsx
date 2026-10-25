import { Input } from "@/components/portal-shell";
import { FieldLabel, Select } from "@/components/ui-kit";
import type { AddressParts, PersonType } from "@/lib/api/types";

export type ClientFormValues = {
  personType: PersonType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rfc: string;
  curp: string;
  ineKey: string;
  birthDate: string;
  addressParts: AddressParts;
};

export const EMPTY_CLIENT: ClientFormValues = {
  personType: "fisica",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  rfc: "",
  curp: "",
  ineKey: "",
  birthDate: "",
  addressParts: { calle: "", numero: "", colonia: "", ciudad: "", estado: "", pais: "México", cp: "" },
};

export const MX_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "CDMX", "Coahuila",
  "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos",
  "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora",
  "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

/**
 * Validación mínima, igual que la plataforma: el CURP es opcional y la clave INE
 * no se valida contra el documento (Héctor lo pidió para no rebotar clientes;
 * esos datos solo alimentan el contrato y se revisan a mano).
 */
export function validateClient(v: ClientFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.firstName.trim()) e.firstName = v.personType === "moral" ? "Razón social requerida" : "Nombre requerido";
  if (v.personType === "fisica" && !v.lastName.trim()) e.lastName = "Apellidos requeridos";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = "Correo inválido";
  if (v.phone.replace(/\D/g, "").length < 10) e.phone = "Teléfono de 10 dígitos";
  const rfcLen = v.personType === "moral" ? 12 : 13;
  if (v.rfc && v.rfc.trim().length !== rfcLen) e.rfc = `El RFC debe tener ${rfcLen} caracteres`;
  if (!v.rfc.trim()) e.rfc = "RFC requerido";
  if (v.curp && v.curp.trim().length !== 18) e.curp = "El CURP tiene 18 caracteres (o déjalo vacío)";
  const a = v.addressParts;
  if (!a.calle?.trim()) e.calle = "Calle requerida";
  if (!a.colonia?.trim()) e.colonia = "Colonia requerida";
  if (!a.ciudad?.trim()) e.ciudad = "Ciudad requerida";
  if (!a.estado?.trim()) e.estado = "Estado requerido";
  if (!/^\d{5}$/.test(a.cp ?? "")) e.cp = "Código postal de 5 dígitos";
  return e;
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-[11px] text-red-600 mt-1">{msg}</p> : null;
}

export function ClientFormFields({
  value,
  onChange,
  errors = {},
  showType = true,
}: {
  value: ClientFormValues;
  onChange: (v: ClientFormValues) => void;
  errors?: Record<string, string>;
  showType?: boolean;
}) {
  const set = <K extends keyof ClientFormValues>(k: K, v: ClientFormValues[K]) => onChange({ ...value, [k]: v });
  const setAddr = (k: keyof AddressParts, v: string) => onChange({ ...value, addressParts: { ...value.addressParts, [k]: v } });
  const moral = value.personType === "moral";
  return (
    <div className="space-y-5">
      {showType && (
        <div className="flex gap-2">
          {(["fisica", "moral"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("personType", t)}
              className={`flex-1 h-10 rounded-lg border text-sm font-semibold transition-colors ${
                value.personType === t ? "border-brand bg-brand-light text-brand-dark" : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t === "fisica" ? "Persona física" : "Persona moral"}
            </button>
          ))}
        </div>
      )}

      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 col-span-full">Datos personales</legend>
        <div>
          <FieldLabel>{moral ? "Razón social" : "Nombre(s)"}</FieldLabel>
          <Input value={value.firstName} onChange={(e) => set("firstName", e.target.value)} />
          <Err msg={errors.firstName} />
        </div>
        <div>
          <FieldLabel>{moral ? "Régimen (S.A. de C.V., etc.)" : "Apellidos"}</FieldLabel>
          <Input value={value.lastName} onChange={(e) => set("lastName", e.target.value)} />
          <Err msg={errors.lastName} />
        </div>
        <div>
          <FieldLabel>Correo</FieldLabel>
          <Input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} />
          <Err msg={errors.email} />
        </div>
        <div>
          <FieldLabel>Teléfono</FieldLabel>
          <Input value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="222 123 4567" />
          <Err msg={errors.phone} />
        </div>
        <div>
          <FieldLabel>RFC</FieldLabel>
          <Input value={value.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} className="font-mono" />
          <Err msg={errors.rfc} />
        </div>
        {!moral && (
          <div>
            <FieldLabel hint="(opcional)">CURP</FieldLabel>
            <Input value={value.curp} onChange={(e) => set("curp", e.target.value.toUpperCase())} className="font-mono" />
            <Err msg={errors.curp} />
          </div>
        )}
        {!moral && (
          <div>
            <FieldLabel hint="(para el contrato)">Clave de elector INE</FieldLabel>
            <Input value={value.ineKey} onChange={(e) => set("ineKey", e.target.value.toUpperCase())} className="font-mono" />
          </div>
        )}
        <div>
          <FieldLabel>{moral ? "Fecha de constitución" : "Fecha de nacimiento"}</FieldLabel>
          <Input type="date" value={value.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 col-span-full">Domicilio</legend>
        <div className="col-span-2 sm:col-span-4">
          <FieldLabel>Calle</FieldLabel>
          <Input value={value.addressParts.calle ?? ""} onChange={(e) => setAddr("calle", e.target.value)} />
          <Err msg={errors.calle} />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <FieldLabel>Número</FieldLabel>
          <Input value={value.addressParts.numero ?? ""} onChange={(e) => setAddr("numero", e.target.value)} />
        </div>
        <div className="col-span-1 sm:col-span-3">
          <FieldLabel>Colonia</FieldLabel>
          <Input value={value.addressParts.colonia ?? ""} onChange={(e) => setAddr("colonia", e.target.value)} />
          <Err msg={errors.colonia} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <FieldLabel>Ciudad / municipio</FieldLabel>
          <Input value={value.addressParts.ciudad ?? ""} onChange={(e) => setAddr("ciudad", e.target.value)} />
          <Err msg={errors.ciudad} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <FieldLabel>Estado</FieldLabel>
          <Select value={value.addressParts.estado ?? ""} onChange={(e) => setAddr("estado", e.target.value)}>
            <option value="">Selecciona…</option>
            {MX_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Err msg={errors.estado} />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <FieldLabel>Código postal</FieldLabel>
          <Input value={value.addressParts.cp ?? ""} onChange={(e) => setAddr("cp", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          <Err msg={errors.cp} />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <FieldLabel>País</FieldLabel>
          <Input value={value.addressParts.pais ?? "México"} onChange={(e) => setAddr("pais", e.target.value)} />
        </div>
      </fieldset>
    </div>
  );
}
