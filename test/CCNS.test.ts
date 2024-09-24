import { assert, expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { CCIPLocalSimulator } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

describe("Set up for testing", function() {
    async function setUp() {    
        const [alice] = await ethers.getSigners();
        
        //1. Creating CCIPLocalSimulator instance
        const ccipLocalSimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
        const ccipLocalSimulator: CCIPLocalSimulator = await ccipLocalSimulatorFactory.deploy();
        
        // 2. Grab config for the test
        const config: {
            chainSelector_: BigNumber;
            sourceRouter_: string;
            destinationRouter_: string;
            wrappedNative_: string;
            linkToken_: string;
            ccipBnM_: string;
            ccipLnM_: string;
        } = await ccipLocalSimulator.configuration();

        // 3. Create instance of CrossChainNameServiceLookup contract
        const crossChainNameServiceLookupFactory = await ethers.getContractFactory("CrossChainNameServiceLookup");
        const sourceCrossChainNameServiceLookup = await crossChainNameServiceLookupFactory.deploy();
        const destCrossChainNameServiceLookup = await crossChainNameServiceLookupFactory.deploy();

        // 4. Create instance of CrossChainNameServiceRegister contract
        const crossChainNameServiceRegisterFactory = await ethers.getContractFactory("CrossChainNameServiceRegister");
        const crossChainNameServiceRegister = await crossChainNameServiceRegisterFactory.deploy(config.sourceRouter_, sourceCrossChainNameServiceLookup.address);

        // 4. Create instance of CrossChainNameServiceReceiver contract
        const crossChainNameServiceReceiverFactory = await ethers.getContractFactory("CrossChainNameServiceReceiver");
        const crossChainNameServiceReceiver = await crossChainNameServiceReceiverFactory.deploy(config.destinationRouter_, destCrossChainNameServiceLookup.address, config.chainSelector_);
        
        return { alice, ccipLocalSimulator, config, sourceCrossChainNameServiceLookup, destCrossChainNameServiceLookup, crossChainNameServiceRegister, crossChainNameServiceReceiver };
    }

    describe("CCNS test", function () {
        it("Verify lookup function successfully return Alice EOA address", async function () {
            const { 
                alice, 
                ccipLocalSimulator, 
                config, 
                crossChainNameServiceRegister, 
                sourceCrossChainNameServiceLookup, 
                destCrossChainNameServiceLookup, 
                crossChainNameServiceReceiver 
            } = await loadFixture(setUp);
            
            await crossChainNameServiceRegister.enableChain(config.chainSelector_, crossChainNameServiceReceiver.address, 500_000);
            
            await sourceCrossChainNameServiceLookup.setCrossChainNameServiceAddress(crossChainNameServiceRegister.address);
            await destCrossChainNameServiceLookup.setCrossChainNameServiceAddress(crossChainNameServiceReceiver.address);
           
            await crossChainNameServiceRegister.connect(alice).register("alice.ccns");

            const destActualRes = await destCrossChainNameServiceLookup.lookup("alice.ccns");
            expect(destActualRes).to.equal(alice.address);
        });
    });
});

