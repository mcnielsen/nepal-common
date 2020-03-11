/**
 *  @author Little Beelzebub <knielsen@alertlogic.com>
 *
 *  @copyright Alert Logic Inc, 2020
 */

/**
 * Describes an objects whose properties can be interrogated/tested using a query's conditions.
 */
export interface AlQuerySubject {
    getPropertyValue( property:string, ns:string ):any;
}

export class AlQueryEvaluator
{
    constructor( public queryDescriptor:any, public id?:string ) {
    }

    public test( subject:AlQuerySubject, queryDescriptor?:any ):boolean {
        return this.dispatchOperator( queryDescriptor || this.queryDescriptor, subject );
    }

    /**
     *  The following dispatch/evaluate methods are support methods used to actually test a search condition against a target object.
     *  The evaluative functionality of SQXSearchQuery doesn't necessarily encompass the full range of operators supported by log search.
     */

    protected dispatchOperator( op:any, subject:AlQuerySubject ):boolean {
        const operatorKeys = Object.keys( op );
        this.assert( op, operatorKeys.length === 1, "an operator descriptor should have a single key." );
        const operatorKey = operatorKeys[0];
        const operatorValue = op[operatorKey];
        switch( operatorKey ) {
            case "and" :
                return this.evaluateAnd( operatorValue, subject );
            case "or" :
                return this.evaluateOr( operatorValue, subject );
            case "=" :
                return this.evaluateEquals( operatorValue, subject );
            case "!=" :
                return this.evaluateNotEquals( operatorValue, subject );
            case "<" :
                return this.evaluateLT( operatorValue, subject );
            case "<=" :
                return this.evaluateLTE( operatorValue, subject );
            case ">" :
                return this.evaluateGT( operatorValue, subject );
            case ">=" :
                return this.evaluateGTE( operatorValue, subject );
            case "in":
                return this.evaluateIn( operatorValue, subject );
            case "not" :
                return this.evaluateNot( operatorValue, subject );
            case "isnull" :
                return this.evaluateIsNull( operatorValue, subject );
            case "contains" :
                return this.evaluateContains( operatorValue, subject );
            case "contains_all" :
                return this.evaluateContainsAll( operatorValue, subject );
            case "contains_any" :
                return this.evaluateContainsAny( operatorValue, subject );
            default :
                throw new Error(`Cannot evaluate unknown operator '${operatorKey}'` );
        }
    }

    protected evaluateAnd( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length > 0, "`and` descriptor should consist of an array of non-zero length" );
        let result = true;
        for ( let i = 0; i < op.length; i++ ) {
            result = result && this.dispatchOperator( op[i], subject );
        }
        return result;
    }

    protected evaluateOr( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length > 0, "`and` descriptor should consist of an array of non-zero length" );
        let result = false;
        for ( let i = 0; i < op.length; i++ ) {
            result = result || this.dispatchOperator( op[i], subject );
        }
        return result;
    }

    protected evaluateEquals( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue === testValue;
    }

    protected evaluateNotEquals( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`!=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue !== testValue;
    }

    protected evaluateLT( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`<` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue < testValue;
    }

    protected evaluateLTE( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`<=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue <= testValue;
    }

    protected evaluateGT( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`>` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue > testValue;
    }

    protected evaluateGTE( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`>=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue >= testValue;
    }

    protected evaluateIn( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`in` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`in` values clause must be an array" );
        return testValues.includes( actualValue );
    }

    protected evaluateNot( op:any, subject:AlQuerySubject ):boolean {
        return ! this.dispatchOperator( op, subject );
    }

    protected evaluateIsNull( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 1, "`isnull` descriptor should have one element" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = subject.getPropertyValue( property.id, property.ns );
        console.log("Actual value: ", actualValue );
        return ( actualValue === null || actualValue === undefined );
    }

    protected evaluateContains( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`contains` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValues = subject.getPropertyValue( property.id, property.ns );
        this.assert( actualValues, typeof( actualValues ) === 'object', "`contains` operator must reference a property that is an object or an array" );
        let testValue = op[1];
        return actualValues.includes( testValue );
    }

    protected evaluateContainsAny( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`contains_any` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValues = subject.getPropertyValue( property.id, property.ns );
        this.assert( actualValues, typeof( actualValues ) === 'object', "`contains_any` operator must reference a property that is an object or an array" );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`contains_any` values clause must be an array" );
        return testValues.reduce( ( alpha:boolean, value:any ) => {
            if ( actualValues instanceof Array ) {
                return alpha || actualValues.includes( value );
            } else {
                return alpha || ( actualValues.hasOwnProperty( value ) && !! actualValues[value] );
            }
        }, false );
    }

    protected evaluateContainsAll( op:any, subject:AlQuerySubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`contains_all` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValues = subject.getPropertyValue( property.id, property.ns );
        this.assert( actualValues, typeof( actualValues ) === 'object', "`contains_all` operator must reference a property that is an object or an array" );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`contains_all` values clause must be an array" );
        return testValues.reduce( ( alpha:boolean, value:any ) => {
            if ( actualValues instanceof Array ) {
                return alpha && actualValues.includes( value );
            } else {
                return alpha && ( actualValues.hasOwnProperty( value ) && !! actualValues[value] );
            }
        }, true );
    }

    protected normalizeProperty( descriptor:any ):{ns:string,id:string} {
        this.assert( descriptor, descriptor.hasOwnProperty("source"), "property reference must include a `source` property" );
        let propertyRef = descriptor.source;
        let propertyName;
        let propertyNs = "default";
        if ( typeof( propertyRef ) === 'object' && propertyRef.hasOwnProperty("ns") && propertyRef.hasOwnProperty("id") ) {
            propertyNs = propertyRef.ns;
            propertyName = propertyRef.id;
        } else if ( typeof( propertyRef ) === 'string' ) {
            propertyName = propertyRef;
        } else {
            throw new Error(`Invalid property reference [${JSON.stringify(descriptor[0].source)}] in condition descriptor` );
        }
        return { ns: propertyNs, id: propertyName };
    }

    protected assert( subject:any, value:boolean, message:string ) {
        if ( ! value ) {
            console.warn("Invalid conditional element", subject );
            throw new Error( `Failed to interpret condition descriptor: ${message}` );
        }
    }
}

