export const permissionDescriptions = {
  'dashboard.view': 'View dashboards within assigned scope',
  'sales.record': 'Record handset sales',
  'sales.void': 'Void recorded sales',
  'sales.backdate': 'Backdate sales within the permitted window',
  'inventory.receive': 'Receive inventory within assigned scope',
  'inventory.adjust': 'Adjust inventory within assigned scope',
  'inventory.import': 'Import opening inventory',
  'masterdata.create': 'Create global handset catalog records',
  'masterdata.manage': 'Correct and manage global handset catalog records',
  'export.run': 'Export authorized filtered data',
  'import.run': 'Import approved source data',
  'audit.view': 'View authorized audit history',
  'users.manage': 'Manage users, assignments and permissions',
} as const;
type PermissionCode = keyof typeof permissionDescriptions;
export interface SeedRole {
  code: string;
  name: string;
  scopeType: 'ALL' | 'CLUSTER' | 'CENTER' | 'ASSIGNED';
  canEditDefault: boolean;
  permissions: PermissionCode[];
}
export const seedRoles: SeedRole[] = [
  // Technical bootstrap role; SYSTEM_ADMIN is not a business role in the BRD.
  {
    code: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    scopeType: 'ALL',
    canEditDefault: true,
    permissions: Object.keys(permissionDescriptions) as PermissionCode[],
  },
  {
    code: 'HEAD_OF_EXPERIENCE_CENTERS',
    name: 'Head of Experience Centers',
    scopeType: 'ALL',
    canEditDefault: false,
    permissions: ['dashboard.view', 'export.run', 'audit.view'],
  },
  {
    code: 'CLUSTER_HEAD',
    name: 'Cluster Head',
    scopeType: 'CLUSTER',
    canEditDefault: false,
    permissions: ['dashboard.view', 'export.run'],
  },
  {
    code: 'EXPERIENCE_CENTER_SUPERVISOR',
    name: 'Experience Center Supervisor',
    scopeType: 'CENTER',
    canEditDefault: true,
    permissions: [
      'dashboard.view',
      'sales.record',
      'inventory.receive',
      'export.run',
    ],
  },
  {
    code: 'EXPERIENCE_CENTER_MANAGER',
    name: 'Experience Center Manager',
    scopeType: 'CENTER',
    canEditDefault: true,
    permissions: [
      'dashboard.view',
      'sales.record',
      'sales.void',
      'sales.backdate',
      'inventory.receive',
      'inventory.adjust',
      'export.run',
      'masterdata.create',
    ],
  },
  // Deny by default until explicit assignments; never grant all-center access by accident.
  {
    code: 'OTHER_STAKEHOLDER',
    name: 'Other Stakeholder',
    scopeType: 'ASSIGNED',
    canEditDefault: false,
    permissions: ['dashboard.view'],
  },
];
export const seedCenters = [
  ['FSD', 'Faisalabad', null],
  ['GUJ', 'Gujranwala', null],
  ['ISB', 'Islamabad', null],
  ['KHI_JH', 'KHI Jazz House', null],
  ['KHI_NNZ', 'KHI North Nazimabad', 'KHI NNZ'],
  ['LHE_EDEN', 'Lahore Eden', null],
  ['LHE_JH', 'Lahore Jazz House', null],
  ['MUX', 'Multan', null],
  ['PEW', 'Peshawar', null],
  ['RYK', 'Rahim Yar Khan', 'RYK'],
] as const;
export const seedBrands = ['Samsung', 'Infinix', 'Tecno', 'Xiaomi', 'Other'];

export const seedColors = [
  'Black',
  'White',
  'Blue',
  'Green',
  'Red',
  'Silver',
  'Gold',
  'Grey',
  'Purple',
  'Pink',
  'Titanium',
  'Orange',
  'Yellow',
  'Brown',
  'Beige',
];
