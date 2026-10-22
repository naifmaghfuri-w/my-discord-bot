import { Schema, model } from "mongoose";

export interface ICompanyPosition {
  title: string;
  salary: number;
}

export interface ICompany {
  guildId: string;
  name: string;
  ownerId: string;
  budget: number;
  positions: ICompanyPosition[];
  lastPayrollAt: Date;
  createdAt: Date;
  /** شعار الشركة (JPEG مصغّر) */
  logo?: Buffer | null;
}

const companySchema = new Schema<ICompany>({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  budget: { type: Number, default: 0 },
  positions: { type: [{ _id: false, title: String, salary: Number }], default: [] },
  lastPayrollAt: { type: Date, default: () => new Date() },
  createdAt: { type: Date, default: () => new Date() },
  logo: { type: Buffer, default: null },
});
companySchema.index({ guildId: 1, name: 1 }, { unique: true });
companySchema.index({ guildId: 1, ownerId: 1 }, { unique: true });

export const Company = model<ICompany>("Company", companySchema);

export type CompanyRole = "owner" | "official" | "employee";

export interface ICompanyMember {
  guildId: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
  title: string;
  salary: number;
  penalty: number;
  lastShiftAt: Date | null;
  joinedAt: Date;
}

const memberSchema = new Schema<ICompanyMember>({
  guildId: { type: String, required: true },
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  role: { type: String, default: "employee" },
  title: { type: String, default: "موظف" },
  salary: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 },
  lastShiftAt: { type: Date, default: null },
  joinedAt: { type: Date, default: () => new Date() },
});
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const CompanyMember = model<ICompanyMember>("CompanyMember", memberSchema);

export interface ICompanyPosting {
  guildId: string;
  companyId: string;
  channelId: string;
  messageId: string;
  title: string;
  slots: number;
  filled: number;
  salary: number;
  open: boolean;
}

const postingSchema = new Schema<ICompanyPosting>({
  guildId: { type: String, required: true },
  companyId: { type: String, required: true, index: true },
  channelId: { type: String, default: "" },
  messageId: { type: String, default: "" },
  title: { type: String, required: true },
  slots: { type: Number, required: true },
  filled: { type: Number, default: 0 },
  salary: { type: Number, required: true },
  open: { type: Boolean, default: true },
});

export const CompanyPosting = model<ICompanyPosting>("CompanyPosting", postingSchema);

export interface ICompanyApplication {
  guildId: string;
  postingId: string;
  companyId: string;
  userId: string;
  about: string;
}

const applicationSchema = new Schema<ICompanyApplication>({
  guildId: { type: String, required: true },
  postingId: { type: String, required: true },
  companyId: { type: String, required: true },
  userId: { type: String, required: true },
  about: { type: String, default: "" },
});
applicationSchema.index({ postingId: 1, userId: 1 }, { unique: true });

export const CompanyApplication = model<ICompanyApplication>("CompanyApplication", applicationSchema);

/** سجلات الشركة (دعم، توظيف، فصل، سرقات...) تظهر للإدارة العليا فقط */
export interface ICompanyLog {
  guildId: string;
  companyId: string;
  text: string;
  createdAt: Date;
}

const logSchema = new Schema<ICompanyLog>({
  guildId: { type: String, required: true },
  companyId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 30 },
});

export const CompanyLog = model<ICompanyLog>("CompanyLog", logSchema);

/** شكاوى الموظفين: تروح لقسم HR فقط */
export interface ICompanyComplaint {
  guildId: string;
  companyId: string;
  fromId: string;
  text: string;
  createdAt: Date;
}

const complaintSchema = new Schema<ICompanyComplaint>({
  guildId: { type: String, required: true },
  companyId: { type: String, required: true, index: true },
  fromId: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 60 },
});

export const CompanyComplaint = model<ICompanyComplaint>("CompanyComplaint", complaintSchema);
