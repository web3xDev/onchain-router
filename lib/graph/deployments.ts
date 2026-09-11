/**
 * Messari standardized lending deployments on The Graph's decentralized network.
 *
 * Generated from messari/subgraphs deployment/decentralized_network_deployments.csv.
 * Every entry answers the same query, which is the point: one schema, many protocols,
 * no per-protocol integration.
 */
export type Deployment = { protocol: string; id: string };

export const LENDING_DEPLOYMENTS: Record<string, Deployment[]> = {
  "ethereum": [
    { "protocol": "aave-amm", "id": "41ooPWnDYKwckqyG1mvg7ZEndy5zMemXinx6uQxscrBS" },
    { "protocol": "aave-arc", "id": "5hyqnEzjZbwFBU1rk4JBknCeiF2Mj93qBzsyQfpAa3QA" },
    { "protocol": "aave-rwa", "id": "C8ynQrjVKcmqxb9fWrLvSCBFNf2ChFkxCg7Q8gknJrza" },
    { "protocol": "aave-v2", "id": "C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2j" },
    { "protocol": "aave-v3", "id": "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk" },
    { "protocol": "abracadabra", "id": "GLAu42kvVs7ixfXcmkAsRiS7Xt1NCpgkKsnz3qiriuvV" },
    { "protocol": "compound-v2", "id": "4TbqVA8p2DoBd5qDbPMwmDZv3CsJjWtxo8nVSqF2tA9a" },
    { "protocol": "compound-v3", "id": "AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9" },
    { "protocol": "cream-finance", "id": "43NeT7UTACLUkohKBaG7auvkhsj4Kwux9kNTJr6sFdNe" },
    { "protocol": "dforce", "id": "6PaB6tKFqrL6YoAELEhFGU6Gc39cEynLbo6ETZMF3sCy" },
    { "protocol": "euler-finance", "id": "95nyAWFFaiz6gykko3HtBCyhRuP5vZzuKYsZiLxHxLhr" },
    { "protocol": "goldfinch", "id": "GRwpFCPYyQPdz84sCnKemzrNvgFPuKkFLcRLR6jsRxHr" },
    { "protocol": "inverse-finance", "id": "EXuutY6qkZbXjYeJZdiDBf2imJswTNdfm8YZCqhAthfW" },
    { "protocol": "iron-bank", "id": "5YoxED3bbWV9byvn3x3S3ebZ3idrQmQmsJhL5LMyY26v" },
    { "protocol": "liquity", "id": "2D2dFCLjUt3MfFgTKW8cBxiRQ3Adss7KUtYh2rTcFVY" },
    { "protocol": "makerdao", "id": "8sE6rTNkPhzZXZC6c8UQy2ghFTu5PPdGauwUBm4t7HZ1" },
    { "protocol": "maple-finance-v1", "id": "J9dtvE11PWNZH74frWyx9QZonyC1Db2UWDMUegmT3zkG" },
    { "protocol": "maple-finance-v2", "id": "94swSaaFChsQoZzb9Vc7Lo6FWFV6YZUMNSdFVTMAeRgj" },
    { "protocol": "morpho-aave-v2", "id": "DsznTYxGdsqxWB6a474rSksvB7qWSth5Ff1PcxW28vZy" },
    { "protocol": "morpho-aave-v3", "id": "FKe6ANnWmGPE6hajGLoTgPrVF2jYPHiRu2Jwcg9ZmG9A" },
    { "protocol": "morpho-compound", "id": "9dTy23tkahyiap1THgwnJuMwxNHVnQM57jFQQiUzjcY6" },
    { "protocol": "qidao", "id": "BmQSQaXsivq866kUobQSbyxycjk3D7CiaczKgu3P9ifB" },
    { "protocol": "rari-fuse", "id": "kecp6SPMvbB4GTqg9r5PXvztYriexj5F3ZCaATpjmb2" },
    { "protocol": "spark-lend", "id": "GbKdmBe4ycCYCQLQSjqGg6UHYoYfbyJyq5WrG35pv1si" },
    { "protocol": "truefi", "id": "39F8fYCvLYmutjqpzEwx3dcEJTtFFVupvBzJqkEzftA7" },
    { "protocol": "uwu-lend", "id": "CZBD7e8VGvNa6WkBHZAaC688bsZ35UvAM1AuDdVng2aE" },
    { "protocol": "zerolend", "id": "4Zf4doH54RDit9KVsfCp3MkjrP3szhJZwvw2z5PHczx9" },
  ],
  "arbitrum": [
    { "protocol": "aave-v3", "id": "4xyasjQeREe7PxnF6wVdobZvCw5mhoHZq3T7guRpuNPf" },
    { "protocol": "abracadabra", "id": "3m97d2dJ2pXwPFuiHrm8T37V9TCoAHBpMqRwdguyUZXF" },
    { "protocol": "compound-v3", "id": "5MjRndNWGhqvNX7chUYLQDnvEgc8DaH8eisEkcJt71SR" },
    { "protocol": "cream-finance", "id": "GzHkVNf7BBqUjV8Sy6U6xUaWdGheFMdin1cB6sNvfdzs" },
    { "protocol": "dforce", "id": "Dpk4Gen22wxQ3Laojf7DR2me8wGzjaHwjsKAsLf2rCFV" },
    { "protocol": "qidao", "id": "Duw2tSACo9uRGFctAGsCc9pF7ZGMyqpjkAHPwm49dZe6" },
    { "protocol": "radiant-capital", "id": "5HTkKJNSm72tUGakwj8yroDGHxc6fBhmLaA5oJepZGL3" },
    { "protocol": "rari-fuse", "id": "HnV3fhwsWfmQGdD2AeGzqvRVTDBqnMH74jCsDVq1DXYP" },
    { "protocol": "vesta-finance", "id": "zGuPrsVqtY5ehJDCmweb9ZnBrae3tSQWRux8Mz1M4Gn" },
  ],
  "bsc": [
    { "protocol": "aave-v3", "id": "43jbGkvSw55sMvYyF6MZieksmJbajMu3hNGF8PN9ucuP" },
    { "protocol": "abracadabra", "id": "6bFCfHn5Uuv5fH7PxKL12dzWh3zz7fkQ46EnMa7nZUj2" },
    { "protocol": "alpaca-finance-lending", "id": "ED3ayhcLA7h7DCGwbysgcxtfMEcoeYCdMEsdZJeoaUFS" },
    { "protocol": "cream-finance", "id": "Dd2ak11qC4mS2spUXzJm5v9EtVNJqmBC9rLzbckTwfN1" },
    { "protocol": "dforce", "id": "DKu1HqTTi26uLZKAmvDbqyAvcnFAjXEuRJmF35RLpyFg" },
    { "protocol": "kinza-finance", "id": "435cubRAqNsFYKzyQHRRiHvR7oJjh828r5Aqe4cZC586" },
    { "protocol": "qidao", "id": "4DcztqYL7UG5bjdisWWvnj3m4NtK5J3bs89scihAkicr" },
    { "protocol": "venus", "id": "CwswJ7sfENafqgAYU1upn3hQgoEV2CXXRZRJ7XtgJrKG" },
  ],
  "avalanche": [
    { "protocol": "aave-v2", "id": "9nh6Ums63wFcoZpmegyPcAFtY3CAzQc3S6cuERALYMqa" },
    { "protocol": "aave-v3", "id": "72Cez54APnySAn6h8MswzYkwaL9KjvuuKnKArnPJ8yxb" },
    { "protocol": "abracadabra", "id": "3Gkei7B24o9C2bCoAbQpApZqMStPta7oCAnNhmNv5dab" },
    { "protocol": "banker-joe", "id": "9NjYuG2BFU1BPacNdKymd9eNdfVCaJM6LhsgD8zSQgDK" },
    { "protocol": "benqi", "id": "8ZjJGsaKea7WwLJPJNdHXPGsvXDe3iq2231aRjgBPisi" },
    { "protocol": "iron-bank", "id": "9YiJM9oHy25estSJjB1Z71Hdz5C814R3vDoS2ezpN27C" },
    { "protocol": "qidao", "id": "98GG74FxxsG25Ltd8qvJ9BRfFmQWyN1AkS92MZBG1BsR" },
  ],
  "fantom": [
    { "protocol": "aave-v3", "id": "ZcLcVKJNQboeqACXhGuL3WFLBZzf5uUWheNsaFvLph6" },
    { "protocol": "abracadabra", "id": "2nxGrxxPShrm49dEWusJjB5dpmonN16JFzLwDrS1pCyq" },
    { "protocol": "alpaca-finance-lending", "id": "6EfFr7xDpD7LLi1X8Cj9b6ytjFjX3GZYrMrCKomEuCmx" },
    { "protocol": "geist-finance", "id": "45LX32kZPBRNiXaBKDrzbCnidoKv3cMEc8cXt3kvPifz" },
    { "protocol": "iron-bank", "id": "4dWx6UZNcLEzgtipy45VkgtptYRqoHdZeCGNKxHAxKWo" },
    { "protocol": "qidao", "id": "hf51jYbZ9uESiuBabfxf6fRdc22xtmNWX9c3SRrct2q" },
    { "protocol": "scream", "id": "Cj3pDoqHgLBntkaXAKMxtJTZr3StxYvVEedTXyJGJoK4" },
  ],
  "polygon": [
    { "protocol": "aave-v2", "id": "GrZQJ7sWdTqiNUD8Vh2THaeBM4wGwiF8mFv9FBfyzwxm" },
    { "protocol": "aave-v3", "id": "6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT" },
    { "protocol": "compound-v3", "id": "5wfoWBpfYv59b99wDxJmyFiKBu9brXESeqJAzw8WP5Cz" },
    { "protocol": "cream-finance", "id": "CBeERkhQNwPwU3jSWdKHeAtPQh4TFucUyUMcqAJk19ij" },
    { "protocol": "dforce", "id": "9CFGPWpntYisBp7NpHMrgYzFrBmtVxSw58haGyZ3ewoZ" },
    { "protocol": "qidao", "id": "5UxEcMvYW4vVYP81tkPQMAvJv1e4m1xU8BJkDXBnpc6x" },
  ],
  "base": [
    { "protocol": "aave-v3", "id": "D7mapexM5ZsQckLJai2FawTKXJ7CqYGKM8PErnS3cJi9" },
    { "protocol": "compound-v3", "id": "AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9" },
    { "protocol": "moonwell", "id": "33ex1ExmYQtwGVwri1AP3oMFPGSce6YbocBP7fWbsBrg" },
    { "protocol": "qidao", "id": "9NHJ9k31qaGCYXppm9isJTiEoiB6v3tJDnR6SrQrxcjw" },
    { "protocol": "seamless-protocol", "id": "2u4mWUV4xS19ef1MbnxZHWLLMwdPxtVifH46JbonXwXP" },
  ],
  "optimism": [
    { "protocol": "aave-v3", "id": "3RWFxWNstn4nP3dXiDfKi9GgBoHx7xzc7APkXs1MLEgi" },
    { "protocol": "dforce", "id": "6AmkakXwadWiZ2jN7oJcFreWmKG1nZrT5P8om52upYPd" },
    { "protocol": "iron-bank", "id": "4WKePP5QfwrW6Hfd8YKWHuivivmdxPubuP45BryeGo4g" },
    { "protocol": "qidao", "id": "4JbWxzxBNCpAaVz72Gt2UthgiwcWZQLKDBhmSE7wKY2K" },
    { "protocol": "sonne-finance", "id": "DQqb7FiQ1joLhESkAwvAYiuXhwfz4zf6qHmbt7stnec8" },
  ],
  "blast": [
    { "protocol": "pac-finance", "id": "ERsfyKMQTpTEN6LtyWvFwhDENLf6aAAggbtrNEnFKLpx" },
    { "protocol": "seismic", "id": "d7gMk1zkEyCQuNVeirBYA6keCZv8hTLheCZ4DBCjRfz" },
    { "protocol": "zerolend", "id": "6JP9542ArawumBSYczerbWGu6k7uu3hqk6qJnSkrgTM5" },
  ],
  "gnosis": [
    { "protocol": "aave-v3", "id": "GiNMLDxT1Bdn2dQZxjQLmW24uwpc3geKUBW8RP6oEdg" },
    { "protocol": "qidao", "id": "7vJEsy8pJmRQZQh5kTXNz68SRHXBS859hMq3o5uWF1Ac" },
    { "protocol": "spark-lend", "id": "Bw4RH37UbbGEhHo4FaWwT1dn9QJzm1XSZCyK1cbr6ZKM" },
  ],
  "harmony": [
    { "protocol": "aave-v3", "id": "G1BNHqmteZiUwSEacfXG2nzMm13KLNo5xoxv62ErAyQv" },
    { "protocol": "qidao", "id": "DCEQvXCiqtpMybQLL4YAgdCzqHzRH6wFFnCDnnLBBuvf" },
  ],
  "moonriver": [
    { "protocol": "moonwell", "id": "8ayELti1UNCNCWuvwSwapjh4mvvCejeXsk4PmsWBmQ82" },
    { "protocol": "qidao", "id": "HzDP5zXKyjnEJP9TnFirk3qA24SUp4AfzKUBSRcBekgz" },
  ],
  "aurora": [
    { "protocol": "bastion-protocol", "id": "BD4rW7Ga5YQ3x68tALbi8vsXNodd6LrvFeaVocdJt3bD" },
  ],
  "linea": [
    { "protocol": "zerolend", "id": "DLzwo1WFaKy7R7MgQWrnBXr19EbGwPRubu9YmsSmRMfC" },
  ],
  "moonbeam": [
    { "protocol": "moonwell", "id": "DQhrdUHwspQf3hSjDtyfS6uqq9YiKoLF3Ut3U9os2HK" },
  ],
  "near": [
    { "protocol": "burrow", "id": "5W5fhZAq6QABBijKo7wqYps7TLzqAqS2mU1C1rhktvtg" },
  ],
  "scroll": [
    { "protocol": "aave-v3", "id": "DkvXMxq1skgSe1ehLHWpiUthHU1znnMDK2SUmj9avhEX" },
  ],
  "xlayer": [
    { "protocol": "zerolend", "id": "NRh6ScvPKoieeSH7tRiKyXJ97DR9aYraas8eREPQ8e3" },
  ],
  "zksync-era": [
    { "protocol": "zerolend", "id": "3CHaJvCkTMqXa4PRKNshVecE9JqgNFCdsXNyGLZXFeM2" },
  ],
};

export const SUPPORTED_CHAINS = Object.keys(LENDING_DEPLOYMENTS);

/**
 * Messari standardized governance deployments.
 *
 * Governance data carries no prices, so it cannot produce the inflated figures that
 * make some DeFi subgraphs unusable: every field is a count or a token amount read
 * straight from events.
 */
export const GOVERNANCE_DEPLOYMENTS: Deployment[] = [
  {
    "protocol": "aave",
    "id": "8EBbn3tNayccBZrnW9ae6Q4NLHfVEcozvkB3YAp5Qatr"
  },
  {
    "protocol": "ampleforth",
    "id": "B7zUhfTTV7mi2QZgUL661D714NGqeLtk6h3q3Mf2xNNa"
  },
  {
    "protocol": "angle",
    "id": "94D1g2jHHqKUS5uhbEPHWyRgfp4bYeZPn5Cr5R3zvoYH"
  },
  {
    "protocol": "compound",
    "id": "7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh"
  },
  {
    "protocol": "cryptex",
    "id": "AnAnCpeyy2ZbP2BLZw9u7VjGtVtRorvYuGU3vME1na7F"
  },
  {
    "protocol": "dydx",
    "id": "FFK9Fa8fdBrAugNVFqRZVAtrej7FjsQNq1s9LVBhF4FX"
  },
  {
    "protocol": "ens",
    "id": "GyijYxW9yiSRcEd5u2gfquSvneQKi5QuvU3WZgFyfFSn"
  },
  {
    "protocol": "euler",
    "id": "F94CS4mephx6noem4KsXxeGDSufCGUH5fXrqUX5ZiFk2"
  },
  {
    "protocol": "gitcoin",
    "id": "By35hUZiWiHNzRsdDnxFU9T47YUNZwPjfhwD1iBbNGQL"
  },
  {
    "protocol": "hifi",
    "id": "ANAXtqRM9cUySpQZ8xuaFTdu1oFCj4HYaRXXiChTihAM"
  },
  {
    "protocol": "hop",
    "id": "9RFPnB3zNjtc7x9kowTyBU2YVGUFSJRe27EBJWLMVgy6"
  },
  {
    "protocol": "maker",
    "id": "FXpCdSzUbRFzovJLW8hrwFXA2E3Bj915w99TtTSMm88p"
  },
  {
    "protocol": "ousd",
    "id": "BwcFTZJskUwk6WXKteMAEqn6CQFWsPsqq8A8YGcqnWkK"
  },
  {
    "protocol": "pooltogether",
    "id": "8rW1keThqpvtoBz7V2iNbo3wqcPCJZTBGuc3frGKbyi2"
  },
  {
    "protocol": "radicle",
    "id": "8jQvvEWJffzA48kxnPhuG7dqv4MWwPatVKKbxzr66xiN"
  },
  {
    "protocol": "rarible",
    "id": "2oGCcncW9v7AAExqpZ9T1W1GecSjGVmi7XGet3P9JiNn"
  },
  {
    "protocol": "reflexer",
    "id": "wWdwntxsEd21qDdhkzDn9ycNs5kvYamkndwv3GwLfPp"
  },
  {
    "protocol": "silo",
    "id": "8qztgeMTJrq2kQHK7LzmbmDUpuBvDc6eFASDqN8SJBM5"
  },
  {
    "protocol": "threshold",
    "id": "Bk9fLLKttYoM4fE1cXXCq61owGqFtX1RsS8kEtDnDELC"
  },
  {
    "protocol": "truefi",
    "id": "DbD7U3k8trdQUC2KqC2Fu2WcS42QUZHr2YXJzZXjH719"
  },
  {
    "protocol": "uniswap",
    "id": "7WXaWRE2GbBpmokFAnQfugpVsC61D9dfR6fHgjQFqpq5"
  },
  {
    "protocol": "unlock",
    "id": "7ziHxbouaMXhSzxf5nfTXLYYASajU9bTCcxWoTKEAkBe"
  }
];

export const GOVERNANCE_PROTOCOLS = GOVERNANCE_DEPLOYMENTS.map((d) => d.protocol);
