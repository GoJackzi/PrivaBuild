// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Privabuild - Private Onchain Collaboration Hub
/// @notice Encrypted submission system using Zama fhEVM + IPFS storage
/// @dev Built for Zama Builder Program - demonstrates fhEVM ACL with off-chain encrypted storage
contract Privabuild is SepoliaConfig {
    struct Submission {
        address builder;
        string builderName;
        string ipfsCID;           // Public IPFS pointer to encrypted data
        euint256 dataHash;        // Encrypted verification hash (fhEVM)
        euint256 encryptionKey;   // Encrypted symmetric key for IPFS data decryption
        euint256 encryptionNonce; // Encrypted nonce for IPFS data decryption
        uint256 timestamp;
    }

    mapping(bytes32 => Submission) public submissions;
    mapping(bytes32 => address[]) private reviewers;
    bytes32[] private submissionIds;
    
    address constant DEFAULT_REVIEWER = 0x000000000000000000000000000000000000dEaD;

    event SubmissionCreated(
        bytes32 indexed id, 
        address indexed builder, 
        string name, 
        string ipfsCID,
        uint256 timestamp
    );
    event AccessGranted(bytes32 indexed id, address indexed reviewer);
    event AccessRevoked(bytes32 indexed id, address indexed reviewer);

    modifier onlyBuilder(bytes32 id) {
        require(msg.sender == submissions[id].builder, "Not submission owner");
        _;
    }

    /// @notice Submit an encrypted project with IPFS storage
    /// @param builderName Public name of the builder
    /// @param ipfsCID IPFS content identifier for encrypted data
    /// @param encryptedHash Encrypted hash for verification (euint256)
    /// @param hashAttestation Gateway attestation for the encrypted hash
    /// @param encryptedKey Encrypted symmetric key for IPFS decryption
    /// @param keyAttestation Gateway attestation for the encrypted key
    /// @param encryptedNonce Encrypted nonce for IPFS decryption
    /// @param nonceAttestation Gateway attestation for the encrypted nonce
    /// @param optionalReviewer Address of reviewer (0x0 for default)
    function submit(
        string memory builderName,
        string memory ipfsCID,
        externalEuint256 encryptedHash,
        bytes calldata hashAttestation,
        externalEuint256 encryptedKey,
        bytes calldata keyAttestation,
        externalEuint256 encryptedNonce,
        bytes calldata nonceAttestation,
        address optionalReviewer
    ) external {
        bytes32 id = keccak256(abi.encode(msg.sender, block.timestamp));
        
        Submission storage s = submissions[id];
        s.builder = msg.sender;
        s.builderName = builderName;
        s.ipfsCID = ipfsCID;
        s.dataHash = FHE.fromExternal(encryptedHash, hashAttestation);
        s.encryptionKey = FHE.fromExternal(encryptedKey, keyAttestation);
        s.encryptionNonce = FHE.fromExternal(encryptedNonce, nonceAttestation);
        s.timestamp = block.timestamp;

        // Grant ACL permissions to contract (required for user decryption)
        FHE.allowThis(s.dataHash);
        FHE.allowThis(s.encryptionKey);
        FHE.allowThis(s.encryptionNonce);
        
        // Grant ACL permissions to builder
        FHE.allow(s.dataHash, msg.sender);
        FHE.allow(s.encryptionKey, msg.sender);
        FHE.allow(s.encryptionNonce, msg.sender);
        
        // Grant ACL to reviewer
        address reviewer = optionalReviewer == address(0) ? DEFAULT_REVIEWER : optionalReviewer;
        FHE.allow(s.dataHash, reviewer);
        FHE.allow(s.encryptionKey, reviewer);
        FHE.allow(s.encryptionNonce, reviewer);
        reviewers[id].push(msg.sender);
        reviewers[id].push(reviewer);
        
        submissionIds.push(id);

        emit SubmissionCreated(id, msg.sender, builderName, ipfsCID, block.timestamp);
    }

    /// @notice Grant access to additional reviewer
    /// @param id Submission ID
    /// @param reviewer Address to grant access to
    function grantAccess(bytes32 id, address reviewer) external onlyBuilder(id) {
        require(reviewer != address(0), "Invalid reviewer address");
        
        Submission storage s = submissions[id];
        FHE.allow(s.dataHash, reviewer);
        FHE.allow(s.encryptionKey, reviewer);
        FHE.allow(s.encryptionNonce, reviewer);
        reviewers[id].push(reviewer);
        
        emit AccessGranted(id, reviewer);
    }

    /// @notice Revoke access from a reviewer (logical revoke)
    /// @dev Note: fhEVM ACL doesn't support native revoke, this is event-based
    /// @param id Submission ID
    /// @param reviewer Address to revoke
    function revokeAccess(bytes32 id, address reviewer) external onlyBuilder(id) {
        require(reviewer != msg.sender, "Cannot revoke own access");
        emit AccessRevoked(id, reviewer);
    }

    /// @notice Get submission metadata (public data only)
    /// @param id Submission ID
    /// @return name Builder name
    /// @return cid IPFS CID
    /// @return time Timestamp
    /// @return builder Builder address
    function getSubmissionMeta(bytes32 id)
        external
        view
        returns (
            string memory name,
            string memory cid,
            uint256 time,
            address builder
        )
    {
        Submission storage s = submissions[id];
        return (s.builderName, s.ipfsCID, s.timestamp, s.builder);
    }

    /// @notice Get all reviewers for a submission
    /// @param id Submission ID
    /// @return Array of reviewer addresses
    function getReviewers(bytes32 id) external view returns (address[] memory) {
        return reviewers[id];
    }

    /// @notice Get all submission IDs
    /// @return Array of submission IDs
    function getAllSubmissionIds() external view returns (bytes32[] memory) {
        return submissionIds;
    }

    /// @notice Get total number of submissions
    /// @return Total count
    function getSubmissionCount() external view returns (uint256) {
        return submissionIds.length;
    }

    /// @notice Get encrypted key handle for user decryption (client-side)
    /// @dev Returns the euint256 handle - decryption happens client-side via Zama SDK
    /// @param id Submission ID
    /// @return Encrypted key handle
    function getEncryptedKey(bytes32 id) external view returns (euint256) {
        Submission storage s = submissions[id];
        require(s.builder != address(0), "Submission does not exist");
        return s.encryptionKey;
    }

    /// @notice Get encrypted nonce handle for user decryption (client-side)
    /// @dev Returns the euint256 handle - decryption happens client-side via Zama SDK
    /// @param id Submission ID
    /// @return Encrypted nonce handle
    function getEncryptedNonce(bytes32 id) external view returns (euint256) {
        Submission storage s = submissions[id];
        require(s.builder != address(0), "Submission does not exist");
        return s.encryptionNonce;
    }
}

