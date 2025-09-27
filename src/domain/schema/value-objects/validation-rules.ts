/**
 * Schema validation rules - minimal implementation
 */
export class ValidationRules {
  static create() {
    return new ValidationRules();
  }

  validate(_data: unknown): boolean {
    return true; // Simplified validation
  }
}
