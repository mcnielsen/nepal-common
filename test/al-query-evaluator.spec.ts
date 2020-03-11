import { expect } from 'chai';
import { describe, before } from 'mocha';
import * as sinon from 'sinon';
import { AlQuerySubject, AlQueryEvaluator } from '../src/utility';

class MockQueryable implements AlQuerySubject
{
    constructor( public data:any ) {
    }

    getPropertyValue( property:string, ns:string ):any {
        if ( this.data.hasOwnProperty( ns ) ) {
            return this.extract( this.data[ns], property.split(".") );
        } else {
            return this.extract( this.data, property.split(".") );
        }
    }

    extract( cursor:any, propertyPath:string[] ):any {
        if ( propertyPath.length === 0 ) {
            return null;
        }
        const property = propertyPath.shift();
        if ( ! cursor.hasOwnProperty( property ) ) {
            return null;
        }
        if ( propertyPath.length === 0 ) {
            return cursor[property];
        } else {
            return this.extract( cursor[property], propertyPath );
        }
    }
}

describe( `AlQueryEvaluator`, () => {
    let queryable:MockQueryable;
    beforeEach( () => {
        queryable = new MockQueryable( {
            "default": {
                "a": true,
                "b": 1,
                "c": "textValue",
                "d": [ "red", "green", "blue" ],
                "e": null,
            }
        } );
    } );
    afterEach( () => {
        sinon.reset();
    } );
    describe( 'test', () => {
        it( 'should evaluate basic queries properly', () => {
            let query = new AlQueryEvaluator( {"and":[{"and":[{"and":[{"and":[{"and":[{"and":[{"=":[{"source":"a"},true]},{"=":[{"source":"b"},1]}]},{"=":[{"source":"c"},"textValue"]}]},{"contains_any":[{"source":"d"},["red","yellow","brown"]]}]},{"contains_all":[{"source":"d"},["red","green","blue"]]}]},{"isnull":[{"source":"e"}]}]},{"=":[{"source":"e"},null]}]} );
            expect( query.test( queryable ) ).to.equal( true );

            let query2 = new AlQueryEvaluator({"or":[{"=":[{"source":"a"},false]},{"<":[{"source":"b"},1]},{"=":[{"source":"c"},"snarfblatt"]},{"contains_any":[{"source":"d"},["pink","orange","purple"]]},{"contains_all":[{"source":"d"},["red","green","blurple"]]},{"isnull":[{"source":"a"}]}]});
            expect( query2.test( queryable ) ).to.equal( false );

        } );
    } );
} );
