export type ClienteTipo = "recurrente" | "unico";
export type ProyectoEstado = "activo" | "pausado" | "finalizado";
export type Prioridad = "alta" | "media" | "baja";
export type TipoCobro = "recurrente" | "unico";
export type TareaEstado = "pendiente" | "en_progreso" | "completada";
export type Currency = "COP" | "USD";

export interface Cliente {
  id: string;
  nombre: string;
  tipo: ClienteTipo;
  color: string;
  created_at: string;
}

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion?: string;
  cliente_id?: string;
  estado: ProyectoEstado;
  prioridad: Prioridad;
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo_cobro: TipoCobro;
  valor_mensual: number;
  valor_total: number;
  currency: Currency;
  color: string;
  horas_logged: number;
  created_at: string;
  // join
  clientes?: Cliente;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion?: string;
  proyecto_id?: string;
  estado: TareaEstado;
  prioridad: Prioridad;
  fecha_limite?: string;
  tiempo_estimado: number; // minutos
  tiempo_real: number;     // minutos
  fecha: string;
  created_at: string;
  // join
  proyectos?: Proyecto;
}

export interface Formacion {
  id: string;
  tema: string;
  area: string;
  fecha: string;
  tiempo_estimado: number;
  tiempo_real: number;
  notas?: string;
  created_at: string;
}

export interface Configuracion {
  id: string;
  formacion_meta_horas: number;
  capacidad_total_horas: number;
  created_at: string;
}
