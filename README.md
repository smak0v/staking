# Staking contract

Simple staking contract with rewards distribution in the same token as designed
for staking.

## Requiremets

- Installed [NodeJS](https://nodejs.org/en/) (tested with NodeJS v15+);
- Installed [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable);
- Installed node modules:

  ```shell
    yarn install
  ```

# Compiling

To compile all contracts run the next command:

```shell
  yarn compile
```

# Testing

To run all the tests execute the next command:

```shell
  yarn test
```

# Deploy

To deploy the contracts you should run the following command:

```shell
  yarn start-sandbox
```

In another terminal window run the next command:

```shell
  yarn deploy:sandbox
```

Contracts will be deployed to the `development` network (in the snadbox).
