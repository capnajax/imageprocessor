'use strict';

const Buffer = require('buffer').Buffer;
const sharp = require('sharp');
const { isNumber } = require('lodash');

const FLIP_X = 'x';
const FLIP_Y = 'y';

function transform(image, transform) {
  if (transform.flip) {
    if (FLIP_X === transform.flip) {
      image = image.flop();
    } else if (FLIP_Y === transform.flip) {
      image = image.flip();
    } else {
      throw Error(`Invalid flip transform ${
        JSON.stringify(transform.flip)}`);
    }
  }
  if (transform.rotate) {
    image = image.rotate(transform.rotate);
  }
  return image;
}

/**
 * @method resize
 * Resize an image, and, optionally, apply a transform
 * @param {Buffer|Sharp} image 
 * @param {object} options supported options are `width`, `height`,
 *  `transform`, and `crop`.
 *  A `transform` can be `rotate` or `flip`. If both `flip`
 *  and `rotate` options are provided, the `flip` will be applied first.
 *  Images are `cropped` after they are transformed. The `crop` parameter is
 *    an object with `top`, `left`, `width`, and `height`.
 *  If `width` or `height` are omitted, the aspect ratio is preserved. If both
 *  are omitted, the size will remain the same.
 * @returns {Buffer} image
 */
async function resize(image, options) {

  image = Buffer.isBuffer(image) ? sharp(image) : image.clone();

  if (options.transform) {
    image = transform(image, options.transform);
  }

  if (options.crop) {
    image = image.extract(options.crop);
  }

  if (options.width || options.height) {
    image = image.resize(
      isNumber(options.width) ? options.width : null,
      isNumber(options.height) ? options.height : null,
      { fit: 'cover',
        position: 'center'
      }
    )
  }

  return image.toBuffer();
}

resize.preread = function preread(buffer, transform) {
  let result = sharp(buffer);
  if (transform) {
    result = transform(result, transform);
  }
  return result;
}

resize.FLIP_X = FLIP_X;
resize.FLIP_Y = FLIP_Y;

module.exports = resize;
