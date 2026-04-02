// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockAuctionNFT is ERC721 {
    uint256 private _nextId = 1;

    constructor() ERC721("Mock Warplet", "WARPLET") {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _mint(to, tokenId);
    }

    /// @dev Mint a specific `tokenId` (for boundary tests). Advances internal counter if needed.
    function mintSpecific(address to, uint256 tokenId) external returns (uint256) {
        require(_ownerOf(tokenId) == address(0), "MockAuctionNFT: minted");
        _mint(to, tokenId);
        if (tokenId >= _nextId) {
            _nextId = tokenId + 1;
        }
        return tokenId;
    }
}
