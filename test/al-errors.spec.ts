import { expect } from 'chai';
import { describe, before } from 'mocha';
import { AlAPIServerError, AlResponseValidationError } from '../src/errors';
import * as sinon from 'sinon';

describe( 'AlAPIServerError', () => {

    it( 'should instantiate as expected', () => {
        const error = new AlAPIServerError( "Some error happened somewhere, somehow", "aims", 401 );

        expect( error.message ).to.be.a("string");
        expect( error.serviceName ).to.equal("aims" );
        expect( error.statusCode ).to.equal( 401 );
    } );

} );

describe( 'AlResponseValidationError', () => {
    let errorStub;
    beforeEach( () => {
        errorStub = sinon.stub( console, 'error' );
    } );
    afterEach( () => {
        errorStub.restore();
    } );
    it( 'should instantiate as expected', () => {
        const error = new AlResponseValidationError( "Some error happened somewhere, somehow", [ { error: true, file: '/file1', line: 120 } ] );

        expect( error.message ).to.be.a("string" );
        expect( error.errors ).to.be.an("array");
        expect( error.errors.length ).to.equal( 1 );

        const error2 = new AlResponseValidationError( "Blahblahblah" );

        expect( error2.message ).to.be.a("string" );
        expect( error2.errors ).to.be.an("array");
        expect( error2.errors.length ).to.equal( 0 );
    } );
} );
