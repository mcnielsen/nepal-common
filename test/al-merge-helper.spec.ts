import { expect } from 'chai';
import { describe, before } from 'mocha';
import { AlMergeHelper } from '../src/utility/al-merge-helper';
import * as sinon from 'sinon';

describe( `AlMergeHelper`, () => {

    let source:any;
    let target:any;
    let merger:AlMergeHelper;

    beforeEach( () => {
        source = {
            a: 1,
            b: 2,
            c: "three",
            d: null,
            f: true,
            z: undefined,
            children: {
                eldest: {
                    "name": "Pepe",
                    "age": 40
                },
                middle: {
                    "name": "Pablo",
                    "age": 37
                },
                youngest: {
                    "name": "Leo",
                    "age": 35
                }
            }
        };
        target = {};
        merger = new AlMergeHelper( source, target );
    } );

    it( `'copy' should copy data if it exists and ignore it if it does not`, () => {
        merger.copy( "a", "b", "c", "d", "e", "y", "z" );
        expect( target ).to.deep.equal( {
            a: 1,
            b: 2,
            c: "three",
            d: null
        } );
    } );
    it( `'rename/renameAll' should rename data if it exists and ignore it if it does not`, () => {
        merger.rename( "a", "ay" );
        merger.rename( "b", "bee" );
        merger.rename( "y", "ye" );
        merger.rename( "z", "zed" );
        merger.renameAll( [ "c", "see" ], [ "d", "duh" ] );
        expect( target ).to.deep.equal( {
            ay: 1,
            bee: 2,
            see: "three",
            duh: null
        } );
    } );
    it( `'transform' should transform data if it exists and ignore it if it does not`, () => {
        merger.transform( "a", "aye", e => e.toString() );
        merger.transform( "b", "be", ( e:number ) => e - 3 );
        merger.transform( "e", "eeeeeeeek", e => { throw new Error("This should never be called, because the property doesn't exist on the source." ); } );
        merger.transform( "f", "foo", ( e:boolean ) => ! e );
        merger.transform( "y", "yeeeeeeeek", e => { throw new Error("This should never be called, because the property doesn't exist on the source." ); } );
        merger.transform( "zed", "zaaaaaap", e => { throw new Error("This should never be called, because the property doesn't exist on the source." ); } );
        expect( target ).to.deep.equal( {
            aye: "1",
            be: -1,
            foo: false
        } );
    } );
    it( `'with' should call a helper function with a property if it exists`, () => {
        let called = 0;
        merger.with( "a", ( a ) => {
            expect( a ).to.equal( 1 );
            called++;
        } );
        merger.with( "f", ( f ) => {
            expect( f ).to.equal( true );
            called++;
        } );
        merger.with( "e", ( e ) => {
            throw new Error("Failure hurts!" );
        } );
        merger.with( "z", ( z ) => {
            throw new Error("Failure hurts!" );
        } );
        expect( called ).to.equal( 2 );
    } );

    it( `'descend()' should call a helper function with a new AlMergeHelper instance`, () => {
        merger.descend( "children", "mcevoy_salgado_progeny", cmerge => {
            cmerge.renameAll( [ "eldest", "pep" ], [ "middle", "pablito" ], [ "youngest", "leo" ] );
        } );
        merger.descend( "nonexistent", null, m => {
            throw new Error("This should never be called.");
        } );
        expect( target ).to.deep.equal( {
            mcevoy_salgado_progeny: {
                pep: {
                    "name": "Pepe",
                    "age": 40
                },
                pablito: {
                    "name": "Pablo",
                    "age": 37
                },
                leo: {
                    "name": "Leo",
                    "age": 35
                }
            }
        } );
    } );
} );
