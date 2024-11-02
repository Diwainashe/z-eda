# process_data.R
library(iarccrgtools)
library(readxl)
library(jsonlite)

process_data <- function(file_path) {
  tryCatch({
    # Read the file based on its extension
    if (grepl(".csv$", file_path)) {
      data <- read.csv(file_path)
    } else if (grepl(".xlsx$", file_path)) {
      data <- readxl::read_excel(file_path)
    } else if (grepl(".json$", file_path)) {
      data <- jsonlite::fromJSON(file_path)
    } else {
      stop("Unsupported file format.")
    }

    # Clean the data using iarccrgtools
    # Replace 'iarc_clean' with the actual iarccrgtools function you need
    result <- iarccrgtools::iarc_clean(data)

    # Return processed result (this can be saved, returned, etc.)
    return(result)

  }, error = function(e) {
    # Capture any errors that occur during processing
    stop("Error processing data: ", e$message)
  })
}
