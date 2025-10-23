/*
Assignment #2
Name: [YOUR NAME HERE]
Good working values:
- mask radius: 3 (7x7)
- s: 1
- k: 100
- threshold: 4
Compiler: Tiny C or Visual Studio

Usage (input from stdin):
<input.ppm> <mask_radius> <s> <k> <threshold>

Notes:
- Uses PPMTools.h APIs: ReadPPM, CreatePPM, WritePPM, GetRPixel, GetGPixel, GetBPixel, PutRPixel, PutGPixel, PutBPixel
- Outputs P6 image 'LoG.ppm' with edges in black, others white
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "PPMTools.h"

static int nearest_int(double value) {
    if (value >= 0.0) {
        return (int)(value + 0.5);
    } else {
        return (int)(value - 0.5);
    }
}

static int log_mask_value(int k, int s, int x, int y) {
    double temp, ans;
    temp = (double)(x * x + y * y) / (double)(s * s);
    ans = (double)k * (2.0 - temp) * exp(-temp / 2.0);
    return nearest_int(ans);
}

static void build_log_mask(int k, int s, int radius, int *maskBuffer) {
    int dim = 2 * radius + 1;
    int yy, xx;
    for (yy = -radius; yy <= radius; ++yy) {
        for (xx = -radius; xx <= radius; ++xx) {
            int v = log_mask_value(k, s, xx, yy);
            maskBuffer[(yy + radius) * dim + (xx + radius)] = v;
        }
    }
}

static int has_zero_crossing_and_threshold(long a, long b, int threshold) {
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
        long diff = a - b;
        if (diff < 0) diff = -diff;
        return diff >= (long)threshold;
    }
    return 0;
}

int main(void) {
    char inputFilename[512];
    int maskRadius, sValue, kValue, threshold;
    unsigned char *inputImage = NULL;
    unsigned char *outputImage = NULL;
    int cols = 0, rows = 0;
    int totalPixels;
    int *grayscale = NULL;
    long *response = NULL;
    int *mask = NULL;
    int dim;
    int x, y;

    if (printf("Enter: <input.ppm> <mask_radius> <s> <k> <threshold>\n") < 0) {
        /* ignore printf failure */
    }
    if (scanf("%511s %d %d %d %d", inputFilename, &maskRadius, &sValue, &kValue, &threshold) != 5) {
        fprintf(stderr, "Error: expected 5 inputs. Example: image.ppm 3 1 100 4\n");
        return 1;
    }
    if (maskRadius < 1) {
        fprintf(stderr, "Error: mask_radius must be >= 1\n");
        return 1;
    }
    if (sValue == 0) {
        fprintf(stderr, "Error: s must be non-zero\n");
        return 1;
    }

    inputImage = ReadPPM(inputFilename, &cols, &rows);
    if (inputImage == NULL) {
        fprintf(stderr, "Error: failed to read PPM '%s'\n", inputFilename);
        return 1;
    }

    outputImage = CreatePPM(cols, rows);
    if (outputImage == NULL) {
        fprintf(stderr, "Error: failed to create output image\n");
        free(inputImage);
        return 1;
    }

    /* Initialize output as white */
    for (y = 0; y < rows; ++y) {
        for (x = 0; x < cols; ++x) {
            PutRPixel(outputImage, cols, x, y, 255);
            PutGPixel(outputImage, cols, x, y, 255);
            PutBPixel(outputImage, cols, x, y, 255);
        }
    }

    totalPixels = cols * rows;
    grayscale = (int *)malloc((size_t)totalPixels * sizeof(int));
    if (grayscale == NULL) {
        fprintf(stderr, "Error: out of memory (grayscale)\n");
        free(outputImage);
        free(inputImage);
        return 1;
    }

    /* Convert input to grayscale intensity */
    for (y = 0; y < rows; ++y) {
        for (x = 0; x < cols; ++x) {
            int r = GetRPixel(inputImage, cols, x, y);
            int g = GetGPixel(inputImage, cols, x, y);
            int b = GetBPixel(inputImage, cols, x, y);
            grayscale[y * cols + x] = (r + g + b) / 3;
        }
    }

    dim = 2 * maskRadius + 1;
    mask = (int *)malloc((size_t)(dim * dim) * sizeof(int));
    if (mask == NULL) {
        fprintf(stderr, "Error: out of memory (mask)\n");
        free(grayscale);
        free(outputImage);
        free(inputImage);
        return 1;
    }
    build_log_mask(kValue, sValue, maskRadius, mask);

    response = (long *)calloc((size_t)totalPixels, sizeof(long));
    if (response == NULL) {
        fprintf(stderr, "Error: out of memory (response)\n");
        free(mask);
        free(grayscale);
        free(outputImage);
        free(inputImage);
        return 1;
    }

    /* Convolution: only compute for valid region, leave borders as 0 */
    for (y = maskRadius; y < rows - maskRadius; ++y) {
        for (x = maskRadius; x < cols - maskRadius; ++x) {
            long sum = 0;
            int yy, xx;
            for (yy = -maskRadius; yy <= maskRadius; ++yy) {
                for (xx = -maskRadius; xx <= maskRadius; ++xx) {
                    int pixel = grayscale[(y + yy) * cols + (x + xx)];
                    int w = mask[(yy + maskRadius) * dim + (xx + maskRadius)];
                    sum += (long)pixel * (long)w;
                }
            }
            response[y * cols + x] = sum;
        }
    }

    /* Zero-crossing detection with threshold (horizontal and vertical) */
    for (y = maskRadius; y < rows - maskRadius; ++y) {
        for (x = maskRadius; x < cols - maskRadius; ++x) {
            long center = response[y * cols + x];
            int isEdge = 0;

            /* Horizontal check: current vs right neighbor */
            if (x + 1 < cols - maskRadius) {
                long right = response[y * cols + (x + 1)];
                if (has_zero_crossing_and_threshold(center, right, threshold)) {
                    isEdge = 1;
                }
            }

            /* Vertical check: current vs down neighbor */
            if (!isEdge && y + 1 < rows - maskRadius) {
                long down = response[(y + 1) * cols + x];
                if (has_zero_crossing_and_threshold(center, down, threshold)) {
                    isEdge = 1;
                }
            }

            if (isEdge) {
                PutRPixel(outputImage, cols, x, y, 0);
                PutGPixel(outputImage, cols, x, y, 0);
                PutBPixel(outputImage, cols, x, y, 0);
            }
        }
    }

    WritePPM(outputImage, cols, rows, "LoG.ppm");

    free(response);
    free(mask);
    free(grayscale);
    free(outputImage);
    free(inputImage);

    if (printf("Wrote output: LoG.ppm\n") < 0) {
        /* ignore */
    }
    return 0;
}
