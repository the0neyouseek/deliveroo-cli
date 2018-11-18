# Deliveroo CLI (WIP)

![Deliveroo logo](./.github/d_logo.svg)

*An unofficial cli for Deliveroo*

[![CircleCI](https://circleci.com/gh/the0neyouseek/deliveroo-cli.svg?style=svg)](https://circleci.com/gh/the0neyouseek/deliveroo-cli)

## Goals

This cli app is a starting point, the main goal being to be able to order food using different sources (Deliveroo, Foodora, Dominos, Mcdonald, & more …) all trough one app only filling your infos (credit card, address, name …) once.

As the APIs I'm using aren't public I won't go any further than this but here are some cool use I've imagined :

- A mobile app combining all food delivery services into a big catalog.
- Google action to order food directly from your Google Home or Google Assistant enabled device
- Home automation using IFTTT. Ordering food for you when triggering a certain scenario (e.g. *Order a pizza if I'll arrive home after 8pm from work on a weekday*)
- Dash button to order your favorite food

## Features

- [x] Check the status of a pending order
- [ ] Place a new order (WIP)
- [ ] Save a previous order to re-order quickly (Not started)

## Installation

```sh
$ npm install deliveroo-cli
```

## How to use

```sh
$ deliveroo-cli
```

## How to help

### Prerequisites
- Node & npm

### Installation
1. Download the sources

    ```sh
    $ git clone https://github.com/the0neyouseek/deliveroo-cli.git
    ```

2. Install node dependencies

    ```sh
    $ npm install
    ```

3. You're done !

To launch the program simply go to the source folder and use

```sh
$ ./deliveroo.js
```

### Issues & New Features

Feel free to open pull requests or issues on GitHub if you want new features or if you find any bug.

### Thanks

- [Node Deliveroo](https://github.com/jzarca01/node-deliveroo) by @jzarca01