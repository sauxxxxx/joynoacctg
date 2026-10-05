import type { Entity, EntityRepository } from './repository'

/** Backend-facing service boundaries. Preview and future API adapters implement these contracts. */
export interface DashboardRepository<TSummary> { load(): Promise<TSummary> }
export interface AuthenticationRepository<TCredentials, TSession> { signIn(credentials: TCredentials): Promise<TSession>; signOut(): Promise<void>; restore(): Promise<TSession | null> }
export interface UsersRolesRepository<TUser extends Entity, TRole extends Entity> { users: EntityRepository<TUser>; roles: EntityRepository<TRole> }
export interface CompanyRepository<TCompanyRecord extends Entity> extends EntityRepository<TCompanyRecord> {}
export interface SalesRepository<TCustomer extends Entity, TDocument extends Entity> { customers: EntityRepository<TCustomer>; documents: EntityRepository<TDocument> }
export interface PurchasesRepository<TVendor extends Entity, TPurchase extends Entity> { vendors: EntityRepository<TVendor>; purchases: EntityRepository<TPurchase> }
export interface AccountingRepository<TAccount extends Entity, TJournal extends Entity> { accounts: EntityRepository<TAccount>; journals: EntityRepository<TJournal> }
export interface BankingRepository<TBankAccount extends Entity, TTransaction extends Entity> { accounts: EntityRepository<TBankAccount>; transactions: EntityRepository<TTransaction> }
export interface FixedAssetsRepository<TAsset extends Entity> extends EntityRepository<TAsset> {}
export interface GovernmentRepository<TTaxRecord extends Entity, TCertificate extends Entity> { taxRecords: EntityRepository<TTaxRecord>; certificates: EntityRepository<TCertificate> }
export interface DocumentsRepository<TDocument extends Entity> extends EntityRepository<TDocument> {}
