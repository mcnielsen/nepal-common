
export type AlJsonType = "object" | "array" | "string" | "boolean" | "number";

export interface AlJsonPropertyDescriptor {
    type: AlJsonType;
    description?:string;
    items?: AlJsonPropertyDescriptor;
    $ref?:string;
}

export interface AlJsonTypeSpecification
{
    type:string;
    properties:{[field:string]:AlJsonPropertyDescriptor};
    required?: string[];
    mininum?:number;
    maximum?:number;
}

export interface AlJsonSchema extends AlJsonTypeSpecification
{
    $id:string;
    description?:string;
    definitions?:{[typeName:string]:AlJsonTypeSpecification};
}

export class AlMicroJsonValidator
{
    protected static schemaDictionary:{[schemaId:string]:AlJsonSchema} = {};

    constructor( ...schemas:AlJsonSchema[] ) {
        schemas.forEach( schema => AlMicroJsonValidator.schemaDictionary[schema.$id] = schema );
    }

    validate( schemaId:string, data:any ) {
        const schema = this.getSchemaById( schemaId );
        this.validateStructure( data, schema );
    }

    validateStructure( cursor:any, typeDescriptor:AlJsonTypeSpecification|string, jsonPath:string[] = [ "" ] ) {
        if ( typeof( typeDescriptor ) === 'string' ) {
            let schema = this.getSchemaById( typeDescriptor );
            typeDescriptor = schema;
        }
        let cursorType = typeof( cursor );
        if ( cursorType !== typeDescriptor.type ) {
            throw new Error(`Value at '${jsonPath.join(".")}' was not of expected type '${typeDescriptor.type}'` );
        }
    }

    getSchemaById( schemaId:string ):AlJsonSchema {
        if ( ! AlMicroJsonValidator.schemaDictionary.hasOwnProperty( schemaId ) ) {
            throw new Error( `No schema with id '${schemaId}' has been added to the validator.` );
        }
        return AlMicroJsonValidator.schemaDictionary[schemaId];
    }
}
