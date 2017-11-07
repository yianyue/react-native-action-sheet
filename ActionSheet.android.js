'use strict';

import React from 'react';

import PropTypes from 'prop-types';

import {
  Animated,
  BackHandler,
  Easing,
  PixelRatio,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
  Dimensions,
  ViewPropTypes
} from 'react-native';

const OPACITY_ANIMATION_TIME = 250;
const Y_ANIMATION_TIME = 250;
const OFFSCREEN_HEIGHT = 9999;
const PIXEL = 1 / PixelRatio.get();
const windowHeight = Dimensions.get('window').height;
const MAX_OPTIONS_HEIGHT = windowHeight - 100; // HACK: does not take into account destructive button
const BORDER_RADIUS = 10; // matches ios
const BUTTON_HEIGHT = 50;

class ActionGroup extends React.Component {
  static propTypes = {
    options: PropTypes.array.isRequired,
    title: PropTypes.string,
    destructiveButtonIndex: PropTypes.number,
    onSelect: PropTypes.func.isRequired,
    startIndex: PropTypes.number.isRequired,
    length: PropTypes.number.isRequired,
    textStyle: Text.propTypes.style,
    contentContainerStyle: ViewPropTypes.style
  };

  render () {
    let {
      options,
      destructiveButtonIndex,
      onSelect,
      startIndex,
      length,
      textStyle,
      contentContainerStyle
    } = this.props;

    let optionViews = [];

    for (let i = startIndex; i < startIndex + length; i++) {
      let color = '#007aff';
      if (i === destructiveButtonIndex) {
        color = '#ff3b30';
      }

      optionViews.push(
        <TouchableOpacity
          key={i}
          onPress={() => onSelect(i)}
          style={styles.button}>
          <Text style={[styles.text, textStyle, {color}]}>
            {options[i]}
          </Text>
        </TouchableOpacity>
      );

      if (i < startIndex + length - 1) {
        optionViews.push(
          <View key={`separator-${i}`} style={styles.rowSeparator} />
        );
      }
    }

    return (
      <View>
        {optionViews}
      </View>
    );
  }
}

// Has same API as https://facebook.github.io/react-native/docs/actionsheetios.html
export default class ActionSheet extends React.Component {
  constructor (props, context) {
    super(props, context);
    this.state = {
      isVisible: false,
      isAnimating: false,
      options: null,
      onSelect: null,
      sheetHeight: OFFSCREEN_HEIGHT,
      overlayOpacity: new Animated.Value(0),
      sheetY: new Animated.Value(-OFFSCREEN_HEIGHT),
      isWaitingForSheetHeight: false,
      optionsHeight: null
    };
  }

  render () {
    let { isVisible } = this.state;
    let overlay = isVisible ? (
      <TouchableWithoutFeedback onPress={this._selectCancelButton}>
        <Animated.View style={[styles.overlay, {
          opacity: this.state.overlayOpacity,
        }]}/>
      </TouchableWithoutFeedback>
    ) : null;

    let sheet = isVisible ? this._renderSheet() : null;

    return (
      <View style={{flex: 1}}>
        {React.Children.only(this.props.children)}
        {overlay}
        {sheet}
      </View>
    );
  }

  _renderSheet () {
    const {optionsHeight, isWaitingForSheetHeight} = this.state;
    let numOptions = this.state.options.options.length;
    return (
      <Animated.View style={[styles.sheetContainer, {
        bottom: this.state.sheetY,
      }]}>
        <View onLayout={this._onLayout} style={styles.sheet}>
          <View style={[{height: optionsHeight, marginVertical: 8}, styles.groupContainer]}>
            {this.state.options.title &&
              <View style={[styles.button, {borderBottomWidth: PIXEL, borderColor: '#cbcbcb' }]}>
                <Text style={styles.titleText}>
                  {this.state.options.title}
                </Text>
              </View>
            }
            {
              !isWaitingForSheetHeight && // HACK: setting optionsHeight before sheetHeight causes the cancel button to not appear initially
              <ScrollView>
                <View onLayout={this._optionsOnLayout}>
                  <ActionGroup
                    options={this.state.options.options}
                    destructiveButtonIndex={this.state.options.destructiveButtonIndex}
                    onSelect={this._onSelect}
                    startIndex={0}
                    length={numOptions - 1}
                    />
                </View>
              </ScrollView>
            }
          </View>
          <View style={[{marginBottom: 8}, styles.groupContainer]}>
            <ActionGroup
              options={this.state.options.options}
              destructiveButtonIndex={this.state.options.destructiveButtonIndex}
              onSelect={this._onSelect}
              startIndex={numOptions - 1}
              length={1}
              textStyle={{fontWeight: 'bold'}}
              />
          </View>
        </View>
      </Animated.View>
    );
  }

  showActionSheetWithOptions (options, onSelect) {
    if (this.state.isVisible) {
      return;
    }

    this.setState({
      options,
      onSelect,
      isVisible: true,
      isAnimating: true,
      isWaitingForSheetHeight: true,
    });

    this.state.overlayOpacity.setValue(0);
    this.state.sheetY.setValue(-this.state.sheetHeight);

    Animated.timing(this.state.overlayOpacity, {
      toValue: 0.3,
      easing: Easing.in(Easing.linear),
      duration: OPACITY_ANIMATION_TIME,
    }).start();

    BackHandler.addEventListener('actionSheetHardwareBackPress', this._selectCancelButton);
  }

  _onSelect = (index) => {
    if (this.state.isAnimating) {
      return;
    }
    this.state.onSelect(index);
    this._animateOut();
  }

  _animateOut = () => {
    if (this.state.isAnimating) {
      return false;
    }

    BackHandler.removeEventListener('actionSheetHardwareBackPress', this._selectCancelButton);

    this.setState({
      isAnimating: true,
    });

    Animated.timing(this.state.overlayOpacity, {
      toValue: 0,
      easing: Easing.in(Easing.linear),
      duration: OPACITY_ANIMATION_TIME,
    }).start(result => {
      if (result.finished) {
        this.setState({
          isVisible: false,
          isAnimating: false,
        });
      }
    });

    Animated.timing(this.state.sheetY, {
      toValue: -this.state.sheetHeight,
      easing: Easing.inOut(Easing.ease),
      duration: Y_ANIMATION_TIME,
    }).start();

    return true;
  }

  _selectCancelButton = () => {
    if (!this.state.options) {
      return false;
    }

    if (typeof this.state.options.cancelButtonIndex === 'number') {
      return this._onSelect(this.state.options.cancelButtonIndex);
    } else {
      return this._animateOut();
    }
  }

  _onLayout = (event) => {
    if (!this.state.isWaitingForSheetHeight) {
      return;
    }
    let height = event.nativeEvent.layout.height;
    this.setState({
      isWaitingForSheetHeight: false,
      sheetHeight: height,
    });

    this.state.sheetY.setValue(-height);
    Animated.timing(this.state.sheetY, {
      toValue: 0,
      easing: Easing.inOut(Easing.ease),
      duration: Y_ANIMATION_TIME,
    }).start(result => {
      if (result.finished) {
        this.setState({
          isAnimating: false,
        });
      }
    });
  }

  _optionsOnLayout = (event) => {
    // ScrollView content height + border
    let height = event.nativeEvent.layout.height + PIXEL * 2;
    if (this.state.options.title) {
      height += BUTTON_HEIGHT;
    }
    this.setState({
      optionsHeight: Math.min(height, MAX_OPTIONS_HEIGHT)
    });
  }
}

let styles = StyleSheet.create({
  groupContainer: {
    backgroundColor: '#fefefe',
    borderRadius: BORDER_RADIUS,
    borderColor: '#cbcbcb',
    borderWidth: PIXEL,
    overflow: 'hidden',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: BUTTON_HEIGHT,
  },
  text: {
    fontSize: 17,
    fontWeight: '400',
  },
  titleText: {
    fontSize: 12,
    color: '#c8c7cc'
  },
  rowSeparator: {
    backgroundColor: '#cbcbcb',
    height: PIXEL,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'black',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: 'transparent',
    marginHorizontal: 8,
  },
});
