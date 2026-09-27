MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_file(filename: str, file_data: bytes) -> tuple[bool, str]:
    """
    Validate the basic properties of an uploaded file.

    Currently, VERA only accepts PDF files.
    """

    # Check if a filename was provided
    if not filename:
        return False, "Filename is required."

    # Check the file extension
    extension = filename.rsplit(".", 1)[-1].lower()

    if extension != "pdf":
        return False, "Only PDF files are accepted."

    # Check if the file is empty
    if len(file_data) == 0:
        return False, "The PDF file is empty."

    # Check maximum file size
    if len(file_data) > MAX_FILE_SIZE:
        return False, "The PDF file exceeds the 10 MB limit."

    return True, "File passed basic validation."