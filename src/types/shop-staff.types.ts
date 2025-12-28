export type StaffRole = 'owner' | 'manager' | 'staff';

export interface ShopStaff {
  id: string;
  shopId: string;
  name: string;
  nickname?: string;
  profileImage?: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  commissionRate: number;
  isActive: boolean;
  hireDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffDto {
  name: string;
  nickname?: string;
  profileImage?: string;
  role?: StaffRole;
  phone?: string;
  email?: string;
  commissionRate?: number;
  hireDate?: string;
  notes?: string;
}

export interface UpdateStaffDto extends Partial<CreateStaffDto> {
  isActive?: boolean;
}

export interface StaffRevenueSummary {
  staffId: string;
  staffName: string;
  staffNickname?: string;
  staffRole: StaffRole;
  commissionRate: number;
  totalReservations: number;
  totalRevenue: number;
  completedCount: number;
  avgRating: number;
}
