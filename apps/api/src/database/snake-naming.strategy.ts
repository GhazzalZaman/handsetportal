import { DefaultNamingStrategy } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }
  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(
      [...embeddedPrefixes, customName || propertyName].join('_'),
    );
  }
  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName);
  }
  joinTableName(first: string, second: string, firstProperty: string): string {
    return snakeCase(
      first + '_' + firstProperty.replace(/\./g, '_') + '_' + second,
    );
  }
  joinTableColumnName(
    table: string,
    property: string,
    column?: string,
  ): string {
    return snakeCase(table + '_' + (column || property));
  }
}
