export class MigrationRunner {
  static async runMigrations(): Promise<void> {
    console.log('Mock migration runner');
  }
  
  static async getMigrationStatus(): Promise<any> {
    return { completed: [] };
  }
  
  static async validateMigrations(): Promise<boolean> {
    return true;
  }
}

export const runMigrations = MigrationRunner.runMigrations;
export const getMigrationStatus = MigrationRunner.getMigrationStatus;
export const validateMigrations = MigrationRunner.validateMigrations;

export default MigrationRunner;
