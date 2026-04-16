// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local-only ERC20 used to stand in for CLAWD when running against the
///      foundry chain. The production deploy on Base wires the real CLAWD
///      address directly and never touches this contract.
contract MockCLAWD is ERC20 {
    constructor() ERC20("Mock CLAWD", "mCLAWD") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
