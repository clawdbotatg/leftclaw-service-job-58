// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ScaffoldETHDeploy } from "./DeployHelpers.s.sol";
import { ClawdFundMe } from "../contracts/ClawdFundMe.sol";
import { MockCLAWD } from "../contracts/MockCLAWD.sol";

/// @notice Deploys ClawdFundMe. On Base mainnet (8453) it points at the live
///         CLAWD token and hands ownership to the client wallet. On any other
///         chain (local foundry / forks) it first deploys MockCLAWD, mints the
///         deployer a large balance for UI testing, and uses that instead.
contract DeployScript is ScaffoldETHDeploy {
    address constant CLAWD_BASE = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address constant CLIENT_OWNER = 0x7E6Db18aea6b54109f4E5F34242d4A8786E0C471;
    uint256 constant LOCAL_MINT = 1_000_000 ether;

    function run() external ScaffoldEthDeployerRunner {
        address clawdAddr;
        if (block.chainid == 8453) {
            clawdAddr = CLAWD_BASE;
        } else {
            MockCLAWD mock = new MockCLAWD();
            mock.mint(deployer, LOCAL_MINT);
            clawdAddr = address(mock);
            deployments.push(Deployment({ name: "MockCLAWD", addr: clawdAddr }));
        }

        ClawdFundMe clawdFundMe = new ClawdFundMe(clawdAddr, CLIENT_OWNER);
        deployments.push(Deployment({ name: "ClawdFundMe", addr: address(clawdFundMe) }));
    }
}
